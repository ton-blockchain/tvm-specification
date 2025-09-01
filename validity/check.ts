import {applySubst, cloneSubst, showType, Subst, tBase, tCont, Type, unify} from "./types"
import {makeSchema} from "./schema"
import {Instr} from "ton-assembly/dist/runtime"
import {Instructions} from "ton-assembly/dist/runtime/util"

export interface CheckOptions {
    readonly dedupe?: boolean
    readonly logContEffects?: boolean
    readonly mergeStacks?: boolean
    readonly showGuards?: boolean
}

export interface CheckResult {
    readonly finalStates: State[]
}

export class StackUnderflowError extends Error {
    constructor(
        public need: number,
        public have: number,
        public at: number,
        public override name: string,
    ) {
        super(`${name}: needs ${need} stack item(s), but only ${have} available (at #${at})`)
    }
}

export class EffectTypeError extends Error {
    constructor(
        public instr: string,
        public index: number,
        public override cause: unknown,
        public stateIdx?: number,
        public guards?: string[],
        public instrObj?: Instr,
    ) {
        super(
            `${instr} at ${instrObj?.loc?.file ?? "unknown"}:${instrObj?.loc?.line ?? -1} @ #${index}${stateIdx !== undefined ? ` (state ${stateIdx}${guards && guards.length ? `; guards=[${guards.join(",")}]` : ""})` : ""}: ${cause instanceof Error ? cause.message : String(cause)}`,
        )
    }
}

/** Pretty-print a stack with current substitution applied. */
export const showStack = (stk: Type[], s: Subst): string => {
    if (stk.length === 0) return "∅"
    return stk.map(t => showType(applySubst(t, s))).join(" ")
}

/** Utility: apply effect (pop inputs, push outputs) on a cloned stack. */
const applyEffect = (stack: Type[], need: number, outs: Type[], s: Subst): Type[] => {
    const res = stack.slice()
    res.splice(res.length - need, need)
    const outs2 = outs.map(t => applySubst(t, s))
    res.push(...outs2)
    return res
}

const unifyStacks = (a: Type[], b: Type[], s: Subst) => {
    if (a.length !== b.length) {
        throw new TypeError(
            `loop body must preserve stack length: got ${a.length}, expected ${b.length}`,
        )
    }
    for (let i = 0; i < a.length; i++) {
        unify(a[i]!, b[i]!, s)
    }
}

export interface State {
    readonly stack: Type[] // bottom -> top
    readonly subst: Subst // var bindings
    readonly guards: string[] // path labels encountered so far
}

/** Optional structural deduplication by stringifying stack+guards. */
const keyOfState = (st: State): string => {
    const types = st.stack.map(t => showType(applySubst(t, st.subst))).join("|")
    const guards = st.guards.join(">")
    return `${types} :: ${guards}`
}

const dedupeStates = (arr: State[]): State[] => {
    const seen = new Set<string>()
    const out: State[] = []
    for (const st of arr) {
        const k = keyOfState(st)
        if (!seen.has(k)) {
            seen.add(k)
            out.push(st)
        }
    }
    return out
}

/** Merge states with identical stack types but different guards */
const mergeStatesByStack = (arr: State[]): State[] => {
    const stackGroups = new Map<string, State[]>()

    // Group states by stack type signature
    for (const st of arr) {
        const stackKey = st.stack.map(t => showType(applySubst(t, st.subst))).join("|")
        if (!stackGroups.has(stackKey)) {
            stackGroups.set(stackKey, [])
        }
        stackGroups.get(stackKey)!.push(st)
    }

    const merged: State[] = []

    // For each stack type group, merge states with same stack
    for (const [stackKey, states] of stackGroups) {
        if (states.length === 1) {
            merged.push(states[0]!)
        } else {
            // Merge multiple states with same stack type
            const first = states[0]!
            const allGuards = states.flatMap(st => st.guards)

            // Use the substitution from the first state (they should be compatible)
            merged.push({
                stack: first.stack,
                subst: first.subst,
                guards: allGuards,
            })
        }
    }

    return merged
}

/** Apply deduplication strategy based on options */
const processStates = (arr: State[], opts: CheckOptions): State[] => {
    if (!opts.dedupe && !opts.mergeStacks) {
        return arr
    }

    let result = arr

    if (opts.mergeStacks) {
        result = mergeStatesByStack(result)
    }

    if (opts.dedupe) {
        result = dedupeStates(result)
    }

    return result
}

/** Human-friendly list of types (applies current substitution). */
const describeTypes = (ts: Type[], s: Subst): string =>
    ts.length ? ts.map(t => showType(applySubst(t, s))).join(" ") : "∅"

/** Longest common prefix length between base and out (bottom -> top), under substitution. */
const commonPrefixLen = (base: Type[], out: Type[], s: Subst): number => {
    const n = Math.min(base.length, out.length)
    for (let i = 0; i < n; i++) {
        const a = applySubst(base[i]!, s)
        const b = applySubst(out[i]!, s)
        if (showType(a) !== showType(b)) return i
    }
    return n
}

/**
 * Summarize continuation body effects relative to a base stack:
 * returns a string like: "σ → σ • i32" or union: "σ → σ • i32  |  σ → σ • i32 • f32".
 */
const summarizeContEffects = (base: Type[], outs: State[]): string => {
    const seen = new Set<string>()
    const parts: string[] = []
    for (const st of outs) {
        const p = commonPrefixLen(base, st.stack, st.subst)
        const suffix = st.stack.slice(p)
        const suffixStr = suffix.length ? " • " + describeTypes(suffix, st.subst) : ""
        const s = `σ → σ${suffixStr}`
        if (!seen.has(s)) {
            seen.add(s)
            parts.push(s)
        }
    }
    return parts.join("  |  ")
}

const runSequence = (
    init: State[],
    prog: readonly Instr[],
    opts: CheckOptions,
    nestingLevel: number = 0,
): State[] => {
    let states = init

    for (let i = 0; i < prog.length; i++) {
        const op = prog[i]
        if (!op) throw new Error("unreachable")

        if (op.$ === "PUSHCONT" || op.$ === "PUSHCONT_SHORT") {
            const next: State[] = []
            for (let si = 0; si < states.length; si++) {
                const st = states[si]!
                const stack2 = st.stack.slice()
                stack2.push(tCont((op.arg0 as Instructions).instructions))
                next.push({stack: stack2, subst: st.subst, guards: st.guards.slice()})
            }
            states = processStates(next, opts)
            continue
        }

        if (op.$ === "IFELSEREF") {
            const indent = "--".repeat(nestingLevel)
            console.log(`${indent}#${i} ${op.$} at ${op.loc?.line} =>`)

            // Order (bottom -> top): int, cont_true
            const next: State[] = []
            for (let si = 0; si < states.length; si++) {
                const st = states[si]!

                const need = 2
                if (st.stack.length < need) {
                    throw new EffectTypeError(
                        "IFELSEREF",
                        i,
                        new StackUnderflowError(need, st.stack.length, i, "IFELSEREF"),
                        si,
                        st.guards,
                        op,
                    )
                }

                const args = st.stack.slice(st.stack.length - need) // [int, cont_true]
                // cond: int
                try {
                    unify(tBase("int"), args[0]!, st.subst)
                } catch {
                    throw new EffectTypeError(
                        "IFELSEREF",
                        i,
                        new TypeError(
                            `condition must be int, got ${showType(applySubst(args[0]!, st.subst))}`,
                        ),
                        si,
                        st.guards,
                        op,
                    )
                }

                const cTrue = applySubst(args[1]!, st.subst)
                const cElse = tCont((op.arg0 as Instructions).instructions)
                if (cElse.tag !== "cont" || cTrue.tag !== "cont") {
                    throw new EffectTypeError(
                        "IFELSEREF",
                        i,
                        new TypeError(
                            `expected (cont_true, cont_else) on top of stack, got (${showType(cTrue)}, ${showType(cElse)})`,
                        ),
                        si,
                        st.guards,
                        op,
                    )
                }
                const base = st.stack.slice(0, st.stack.length - need)

                // true branch
                const stTrueInit: State = {
                    stack: base.slice(),
                    subst: cloneSubst(st.subst),
                    guards: [...st.guards, "if_true"],
                }
                const outTrue = runSequence([stTrueInit], cTrue.body, opts, nestingLevel + 1)
                if (opts.logContEffects) {
                    console.log(
                        `[IFELSEREF] true-cont effect: ${summarizeContEffects(base, outTrue)}`,
                    )
                }

                // else branch
                const stElseInit: State = {
                    stack: base.slice(),
                    subst: cloneSubst(st.subst),
                    guards: [...st.guards, "if_false"],
                }
                const outElse = runSequence([stElseInit], cElse.body, opts, nestingLevel + 1)
                if (opts.logContEffects) {
                    console.log(
                        `[IFELSEREF] else-cont effect: ${summarizeContEffects(base, outElse)}`,
                    )
                }

                next.push(...outTrue, ...outElse)
            }
            states = processStates(next, opts)
            continue
        }

        if (op.$ === "IFELSE") {
            const indent = "--".repeat(nestingLevel)
            console.log(`${indent}#${i} ${op.$} at ${op.loc?.line} =>`)

            // Order (bottom -> top): int, cont_true, cont_else
            const next: State[] = []
            for (let si = 0; si < states.length; si++) {
                const st = states[si]!

                const need = 3
                if (st.stack.length < need) {
                    throw new EffectTypeError(
                        "IFELSE",
                        i,
                        new StackUnderflowError(need, st.stack.length, i, "IFELSE"),
                        si,
                        st.guards,
                        op,
                    )
                }

                const args = st.stack.slice(st.stack.length - need) // [int, cont_true, cont_else]
                // cond: int
                try {
                    unify(tBase("int"), args[0]!, st.subst)
                } catch {
                    throw new EffectTypeError(
                        "IFELSE",
                        i,
                        new TypeError(
                            `condition must be int, got ${showType(applySubst(args[0]!, st.subst))}`,
                        ),
                        si,
                        st.guards,
                        op,
                    )
                }

                const cTrue = applySubst(args[1]!, st.subst)
                const cElse = applySubst(args[2]!, st.subst)
                if (cElse.tag !== "cont" || cTrue.tag !== "cont") {
                    throw new EffectTypeError(
                        "IFELSE",
                        i,
                        new TypeError(
                            `expected (cont_true, cont_else) on top of stack, got (${showType(cTrue)}, ${showType(cElse)})`,
                        ),
                        si,
                        st.guards,
                        op,
                    )
                }
                const base = st.stack.slice(0, st.stack.length - need)

                // true branch
                const stTrueInit: State = {
                    stack: base.slice(),
                    subst: cloneSubst(st.subst),
                    guards: [...st.guards, "if_true"],
                }
                const outTrue = runSequence([stTrueInit], cTrue.body, opts, nestingLevel + 1)
                if (opts.logContEffects) {
                    console.log(`[IFELSE] true-cont effect: ${summarizeContEffects(base, outTrue)}`)
                }

                // else branch
                const stElseInit: State = {
                    stack: base.slice(),
                    subst: cloneSubst(st.subst),
                    guards: [...st.guards, "if_false"],
                }
                const outElse = runSequence([stElseInit], cElse.body, opts, nestingLevel + 1)
                if (opts.logContEffects) {
                    console.log(`[IFELSE] else-cont effect: ${summarizeContEffects(base, outElse)}`)
                }

                next.push(...outTrue, ...outElse)
            }
            states = processStates(next, opts)
            continue
        }

        if (op.$ === "IF" || op.$ === "IFJMP" || op.$ === "IFNOT" || op.$ === "IFNOTJMP") {
            const indent = "--".repeat(nestingLevel)
            console.log(`${indent}#${i} ${op.$} at ${op.loc?.line} =>`)

            const next: State[] = []
            for (let si = 0; si < states.length; si++) {
                const st = states[si]!

                // Need top two: int (below), cont (top)
                const need = 2
                if (st.stack.length < need) {
                    throw new EffectTypeError(
                        "IF",
                        i,
                        new StackUnderflowError(need, st.stack.length, i, "IF"),
                        si,
                        st.guards,
                        op,
                    )
                }
                const args = st.stack.slice(st.stack.length - need) // [int, cont]
                try {
                    // unify cond with int
                    unify(tBase("int"), args[0]!, st.subst)
                } catch {
                    throw new EffectTypeError(
                        "IF",
                        i,
                        new TypeError(
                            `condition must be int, got ${showType(applySubst(args[0]!, st.subst))}`,
                        ),
                        si,
                        st.guards,
                        op,
                    )
                }
                const contVal = applySubst(args[1]!, st.subst)
                if (contVal.tag !== "cont") {
                    throw new EffectTypeError(
                        "IF",
                        i,
                        new TypeError(
                            `expected continuation on top of stack, got ${showType(contVal)}`,
                        ),
                        si,
                        st.guards,
                        op,
                    )
                }

                // Base stack is everything below those two
                const baseStack = st.stack.slice(0, st.stack.length - need)

                // False path: skip continuation
                next.push({
                    stack: baseStack.slice(),
                    subst: st.subst,
                    guards: [...st.guards, "if_false"],
                })

                // True path: run cont body on base stack
                const trueInit: State = {
                    stack: baseStack.slice(),
                    subst: cloneSubst(st.subst),
                    guards: [...st.guards, "if_true"],
                }
                const trueOut = runSequence([trueInit], contVal.body, opts, nestingLevel + 1)
                if (opts.logContEffects) {
                    console.log(`[IF] cont effect: ${summarizeContEffects(baseStack, trueOut)}`)
                }

                if (op.$ === "IF" || op.$ === "IFNOT") {
                    // don't add true state for IFJMP since we don't return from IFJMP
                    next.push(...trueOut)
                }
            }
            states = processStates(next, opts)
            continue
        }

        if (op.$ === "PUSHREFCONT") {
            const indent = "--".repeat(nestingLevel)
            console.log(`${indent}#${i} ${op.$} at ${op.loc?.line} =>`)

            const next: State[] = []
            for (let si = 0; si < states.length; si++) {
                const st = states[si]!

                const contVal = tCont((op.arg0 as Instructions).instructions)

                next.push({
                    stack: [...st.stack.slice(), contVal],
                    subst: st.subst,
                    guards: [...st.guards],
                })
            }
            states = processStates(next, opts)
            continue
        }

        if (op.$ === "CALLREF" || op.$ === "PSEUDO_PUSHREF") {
            const indent = "--".repeat(nestingLevel)
            console.log(`${indent}#${i} ${op.$} at ${op.loc?.line} =>`)

            const next: State[] = []
            for (let si = 0; si < states.length; si++) {
                const st = states[si]!

                const contVal = tCont((op.arg0 as Instructions).instructions)

                const trueInit: State = {
                    stack: st.stack.slice(),
                    subst: cloneSubst(st.subst),
                    guards: [...st.guards],
                }
                const out = runSequence([trueInit], contVal.body, opts, nestingLevel + 1)

                next.push(...out)
            }
            states = processStates(next, opts)
            continue
        }

        if (op.$ === "UNTIL") {
            const indent = "--".repeat(nestingLevel)
            console.log(`${indent}#${i} ${op.$} at ${op.loc?.line} =>`)

            const next: State[] = []
            for (let si = 0; si < states.length; si++) {
                const st = states[si]!

                // need top: cont
                const need = 1
                if (st.stack.length < need) {
                    throw new EffectTypeError(
                        "UNTIL",
                        i,
                        new StackUnderflowError(need, st.stack.length, i, "UNTIL"),
                        si,
                        st.guards,
                        op,
                    )
                }

                const top = applySubst(st.stack[st.stack.length - 1]!, st.subst)
                if (top.tag !== "cont") {
                    throw new EffectTypeError(
                        "UNTIL",
                        i,
                        new TypeError(
                            `expected continuation on top of stack, got ${showType(top)}`,
                        ),
                        si,
                        st.guards,
                        op,
                    )
                }

                // base stack is below cont
                const base = st.stack.slice(0, st.stack.length - 1)

                // run one iteration of the body on the base stack
                const iterInit: State = {
                    stack: base.slice(),
                    subst: cloneSubst(st.subst),
                    guards: [...st.guards, "until_body"],
                }
                const outs = runSequence([iterInit], top.body, opts, nestingLevel + 1)

                if (outs.length === 0) {
                    throw new EffectTypeError(
                        "UNTIL",
                        i,
                        new TypeError(`loop body produced no states`),
                        si,
                        st.guards,
                        op,
                    )
                }

                for (let oi = 0; oi < outs.length; oi++) {
                    const out = outs[oi]!

                    // body must leave an int flag on top
                    if (out.stack.length < 1) {
                        throw new EffectTypeError(
                            "UNTIL",
                            i,
                            new TypeError(
                                `loop body must leave an int flag on top (got empty stack)`,
                            ),
                            si,
                            out.guards,
                            op,
                        )
                    }
                    try {
                        unify(tBase("int"), out.stack[out.stack.length - 1]!, out.subst)
                    } catch {
                        throw new EffectTypeError(
                            "UNTIL",
                            i,
                            new TypeError(
                                `loop body must leave int flag, got ${showType(applySubst(out.stack[out.stack.length - 1]!, out.subst))}`,
                            ),
                            si,
                            out.guards,
                            op,
                        )
                    }

                    // pop the flag
                    const post = out.stack.slice(0, out.stack.length - 1)

                    // invariant: post must unify with base (so next iteration is well-typed)
                    try {
                        unifyStacks(post, base, out.subst)
                    } catch {
                        throw new EffectTypeError(
                            "UNTIL",
                            i,
                            new TypeError(
                                `loop body must preserve stack shape after popping flag.\n  before: ${showStack(base, out.subst)}\n  after : ${showStack(post, out.subst)}`,
                            ),
                            si,
                            out.guards,
                            op,
                        )
                    }

                    // exit effect: stack equals post (now unified with base)
                    next.push({
                        stack: post.map(t => applySubst(t, out.subst)),
                        subst: out.subst,
                        guards: [...out.guards, "until_exit"],
                    })
                }
            }
            states = processStates(next, opts)
            continue
        }

        // Regular schema-based op (may have alternatives)
        const schema = makeSchema(op)
        const nextStates: State[] = []

        for (let si = 0; si < states.length; si++) {
            const st = states[si]!

            // 1) Check underflow
            const need = schema.in.length
            if (st.stack.length < need) {
                throw new EffectTypeError(
                    schema.name,
                    i,
                    new StackUnderflowError(need, st.stack.length, i, schema.name),
                    si,
                    st.guards,
                    op,
                )
            }

            // 2) Unify inputs
            const args = st.stack.slice(st.stack.length - need) // bottom -> top
            try {
                for (let j = 0; j < need; j++) {
                    unify(schema.in[j]!, args[j]!, st.subst)
                }
                // 3) Extra checks on inputs
                if (schema.check) schema.check(st.subst)
            } catch (e) {
                throw new EffectTypeError(schema.name, i, e, si, st.guards, op)
            }

            // 4) Spawn alternatives
            for (const alt of schema.alts) {
                const subst2 = cloneSubst(st.subst)
                const stack2 = applyEffect(st.stack, need, alt.out, subst2)
                const guards2 = alt.guard ? [...st.guards, alt.guard] : st.guards.slice()
                nextStates.push({stack: stack2, subst: subst2, guards: guards2})
            }
        }

        states = processStates(nextStates, opts)

        // Debug trace
        const indent = "  ".repeat(nestingLevel)
        console.log(`${indent}#${i} ${op.$} at ${op.loc?.line} =>`)
        states.forEach((st, k) => {
            const stackStr = showStack(st.stack, st.subst)
            const guardsStr = opts.showGuards !== false ? `  guards=[${st.guards.join(",")}]` : ""
            console.log(`${indent}  [${k}] ${stackStr}${guardsStr}`)
        })
    }

    return states
}

export const checkProgram = (prog: Instr[], opts: CheckOptions = {}): CheckResult => {
    const start: State = {stack: [], subst: new Map(), guards: []}
    const finalStates = runSequence([start], prog, opts)
    return {finalStates}
}
