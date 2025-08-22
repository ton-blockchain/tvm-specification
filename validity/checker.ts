/**
 * Minimal stack-VM type checker (step 1)
 * -------------------------------------------------------------
 * Goal: super simple, readable start.
 * - Stack is an array of types, bottom -> top.
 * - Each instruction has a "stack effect schema": inputs[] -> outputs[]
 *   (both are written bottom -> top as well).
 * - We implement just a few basics: PUSH_i32, PUSH_f32, POP, DUP, SWAP, ADD (polymorphic numeric, same-type).
 * - No control-flow yet; we type-check a straight-line sequence.
 *
 * We'll extend this later with: constraints, index variables, vectors, CFG, merges, etc.
 */

// ---------- Types ----------

export type BaseName = 'i32' | 'i64' | 'f32' | 'f64' | 'bool' | 'byte';

export interface TBase { tag: 'base'; name: BaseName }
export interface TVar  { tag: 'var';  id: number; hint?: string }
export interface TCont { tag: 'cont'; body: readonly Op[] }         // NEW: continuation type carries its body
export type Type = TBase | TVar | TCont;

export const tBase = (name: BaseName): TBase => ({ tag: 'base', name });
export const tCont = (body: readonly Op[]): TCont => ({ tag: 'cont', body });

let VAR_COUNTER = 0;
export const freshVar = (hint?: string): TVar => ({ tag: 'var', id: ++VAR_COUNTER, hint });

const freshVars = (n: number, prefix = 'τ'): TVar[] =>
    Array.from({ length: n }, (_, i) => freshVar(`${prefix}${i}`));

export const showType = (t: Type): string => {
    if (t.tag === 'base') return t.name;
    if (t.tag === 'cont') return 'cont'; // don't print body here
    return t.hint ? `${t.hint}${t.id}` : `α${t.id}`;
};

// ---------- Substitution / Unification ----------

/** Map var-id -> Type (can point to base or another var). */
export type Subst = Map<number, Type>;

/** Deep copy of substitution. */
export const cloneSubst = (s: Subst): Subst => new Map(s);

/** Deref through the substitution until we reach a non-var or an unbound var. */
export const deref = (t: Type, s: Subst): Type => {
    if (t.tag === 'var') {
        const seen = new Set<number>();
        let cur: Type = t;
        while (cur.tag === 'var') {
            if (seen.has(cur.id)) break; // cycle guard (shouldn't happen here)
            seen.add(cur.id);
            const next = s.get(cur.id);
            if (!next) break;
            cur = next;
        }
        return cur;
    }
    return t;
};

/** Bind variable v to type t (t may be var or base). */
const bindVar = (v: TVar, t: Type, s: Subst) => {
    // trivial: α = α
    const tt = deref(t, s);
    if (tt.tag === 'var' && tt.id === v.id) return;
    s.set(v.id, tt);
};

/** Unify two types under substitution s. */
export const unify = (a: Type, b: Type, s: Subst) => {
    const aa = deref(a, s);
    const bb = deref(b, s);
    if (aa.tag === 'var') return bindVar(aa, bb, s);
    if (bb.tag === 'var') return bindVar(bb, aa, s);

    // cont vs cont (we ignore body equality here)
    if (aa.tag === 'cont' && bb.tag === 'cont') return;

    if (aa.tag === 'base' && bb.tag === 'base') {
        // both base
        if (aa.name !== bb.name) {
            throw new TypeError(`Type mismatch: ${aa.name} vs ${bb.name}`);
        }
        return
    }

    throw new TypeError(`Type mismatch: ${showType(aa)} vs ${showType(bb)}`);
};

/** Apply substitution to a type (one step of deref). */
export const applySubst = (t: Type, s: Subst): Type => deref(t, s);

/** Require that a type is a concrete base (after substitution). */
export const asBase = (t: Type, s: Subst): TBase => {
    const tt = deref(t, s);
    if (tt.tag !== 'base') {
        throw new TypeError(`Type must be concrete, got ${showType(tt)}`);
    }
    return tt;
};

// ---------- Instruction schemas ----------

export interface Alt {
    readonly out: Type[];                // стек на выходе этой альтернативы
    readonly guard?: string;             // метка (например 'ok' | 'overflow'), опционально
}

/**
 * A schema describes stack inputs/outputs.
 * All arrays are bottom -> top order. Example: [α, α] means two items, top is the last α.
 */
export interface Schema {
    readonly name: string;
    readonly in: Type[];   // bottom -> top
    readonly alts: Alt[];                // >=1 альтернатив
    readonly check?: (s: Subst) => void; // extra constraints after unification
}

/** Numeric type class. */
export const isNumeric = (t: TBase): boolean => (
    t.name === 'i32' || t.name === 'i64' || t.name === 'f32' || t.name === 'f64'
);

/** Helpers to create schemas with fresh vars each time. */
export const SCHEMAS = {
    PUSH_i32(): Schema {
        return { name: 'PUSH_i32', in: [], alts: [ {out: [tBase('i32')] }]};
    },
    PUSH_i64(): Schema {
        return { name: 'PUSH_i64', in: [], alts: [ {out: [tBase('i64')] }]};
    },
    PUSH_f32(): Schema {
        return { name: 'PUSH_f32', in: [], alts: [ {out: [tBase('f32')] }]};
    },
    PUSH_byte(): Schema {
        return { name: 'PUSH_byte', in: [], alts: [{ out: [tBase('byte')] }] };
    },
    PUSH_k(k: number): Schema {
        if (!Number.isInteger(k) || k < 0) {
            throw new TypeError(`PUSH_k: k must be non-negative integer, got ${k}`);
        }
        const vs = freshVars(k + 1);         // [α0..αk], αk — это и есть «k-й от вершины»
        return {
            name: `PUSH_k(${k})`,
            in: vs,
            alts: [{ out: [...vs, vs[vs.length - 1 - k]!] }],  // вернуть все снятые + дубликат αk
        };
    },
    XCHG_IJ(i: number, j: number): Schema {
        if (!Number.isInteger(i) || !Number.isInteger(j) || i < 0 || j < 0) {
            throw new TypeError(`XCHG_IJ: indices must be non-negative integers, got (${i}, ${j})`);
        }
        const N = Math.max(i, j);
        const m = N + 1;                   // сколько верхних элементов трогаем
        const vs = freshVars(m, 'χ');      // [χ0 .. χN], bottom -> top для среза

        // Считаем индексы внутри массива vs (они bottom->top)
        const p_i = m - 1 - i;             // позиция элемента с индексом i от вершины
        const p_j = m - 1 - j;

        const out = vs.slice();
        const tmp = out[p_i]!;
        out[p_i] = out[p_j]!;
        out[p_j] = tmp;

        return {
            name: `XCHG_IJ(${i},${j})`,
            in: vs,
            alts: [{ out }],
        };
    },
    POP(): Schema {
        const a = freshVar('α');
        return { name: 'POP', in: [a], alts: [ {out: [] }]};
    },
    NIP(): Schema {
        const a = freshVar('α');
        const b = freshVar('β');
        return { name: 'NIP', in: [a, b], alts: [ {out: [b] }]};
    },
    DUP(): Schema {
        const a = freshVar('α');
        return { name: 'DUP', in: [a], alts: [ {out: [a, a] }]};
    },
    SWAP(): Schema {
        const a = freshVar('α');
        const b = freshVar('β');
        return { name: 'SWAP', in: [a, b], alts: [ {out: [b, a] }]};
    },
    ADD(): Schema {
        const a = freshVar('α');
        return {
            name: 'ADD',
            in: [a, a],
            alts: [ {out: [a]}],
            check: (s: Subst) => {
                const aa = asBase(a, s);
                if (!isNumeric(aa)) {
                    throw new TypeError(`ADD expects numeric types, got ${aa.name}`);
                }
            }
        };
    },
    ADDQ(): Schema {
        return {
            name: 'ADDQ',
            in:  [ tBase('byte'), tBase('byte') ],
            alts: [
                { guard: 'overflow', out: [ tBase('i32') ] },
                { guard: 'ok',       out: [ tBase('i32'), tBase('byte') ] },
            ],
        };
    },
    DIVQ(): Schema {
        return {
            name: 'DIVQ',
            in:  [ tBase('i32'), tBase('i32') ],
            alts: [
                { guard: 'overflow', out: [ tBase('i32'), tBase('i32') ] },
                { guard: 'ok',       out: [ tBase('i32'), tBase('i32') ] },
            ],
        };
    }
};

// ---------- VM instruction set (surface) ----------

export type Op =
    | { readonly op: 'PUSH_i32' }
    | { readonly op: 'PUSH_i64' }
    | { readonly op: 'PUSH_f32' }
    | { readonly op: 'PUSH_byte' }
    | { readonly op: 'PUSH_cont', readonly body: readonly Op[] } // NEW
    | { readonly op: 'PUSH_k', readonly k: number }
    | { readonly op: 'XCHG_IJ', readonly i: number, readonly j: number }
    | { readonly op: 'IF' }
    | { readonly op: 'IFELSE' }
    | { readonly op: 'UNTIL' }
    | { readonly op: 'POP' }
    | { readonly op: 'NIP' }
    | { readonly op: 'DUP' }
    | { readonly op: 'SWAP' }
    | { readonly op: 'ADD' }
    | { readonly op: 'ADDQ' }
    | { readonly op: 'DIVQ' }

export const makeSchema = (op: Op): Schema => {
    switch (op.op) {
        case 'PUSH_i32':  return SCHEMAS.PUSH_i32();
        case 'PUSH_i64':  return SCHEMAS.PUSH_i64();
        case 'PUSH_f32':  return SCHEMAS.PUSH_f32();
        case 'PUSH_byte': return SCHEMAS.PUSH_byte();
        case 'PUSH_k':    return SCHEMAS.PUSH_k(op.k);
        case 'XCHG_IJ':   return SCHEMAS.XCHG_IJ(op.i, op.j);
        case 'POP':       return SCHEMAS.POP();
        case 'NIP':       return SCHEMAS.NIP();
        case 'DUP':       return SCHEMAS.DUP();
        case 'SWAP':      return SCHEMAS.SWAP();
        case 'ADD':       return SCHEMAS.ADD();
        case 'ADDQ':      return SCHEMAS.ADDQ();
        case 'DIVQ':      return SCHEMAS.DIVQ();
        default:          throw new Error(`No schema for op ${ (op as any).op }`);
    }
};

// ---------- Type checker for a straight-line program ----------

export interface CheckOptions {
    readonly dedupe?: boolean
}

export interface CheckResult {
    readonly finalStates: State[]; // resulting set of states after the whole program
}

export class StackUnderflowError extends Error {
    constructor(public need: number, public have: number, public at: number, public override name: string) {
        super(`${name}: needs ${need} stack item(s), but only ${have} available (at #${at})`);
    }
}

export class EffectTypeError extends Error {
    constructor(public instr: string, public index: number, public override cause: unknown, public stateIdx?: number, public guards?: string[]) {
        super(`${instr} @ #${index}${stateIdx !== undefined ? ` (state ${stateIdx}${guards && guards.length ? `; guards=[${guards.join(',')}]` : ''})` : ''}: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
}

/** Pretty-print a stack with current substitution applied. */
export const showStack = (stk: Type[], s: Subst): string => {
    if (stk.length === 0) return '∅';
    return stk.map(t => showType(applySubst(t, s))).join(' ');
};

/** Utility: apply effect (pop inputs, push outputs) on a cloned stack. */
const applyEffect = (stack: Type[], need: number, outs: Type[], s: Subst): Type[] => {
    const res = stack.slice();
    res.splice(res.length - need, need);
    const outs2 = outs.map(t => applySubst(t, s));
    res.push(...outs2);
    return res;
};

const unifyStacks = (a: Type[], b: Type[], s: Subst) => {
    if (a.length !== b.length) {
        throw new TypeError(`loop body must preserve stack length: got ${a.length}, expected ${b.length}`);
    }
    for (let i = 0; i < a.length; i++) {
        unify(a[i]!, b[i]!, s);
    }
};

export interface State {
    readonly stack: Type[]; // bottom -> top
    readonly subst: Subst; // var bindings
    readonly guards: string[]; // path labels encountered so far
}

/** Optional structural deduplication by stringifying stack+guards. */
const keyOfState = (st: State): string => {
    const types = st.stack.map(t => showType(applySubst(t, st.subst))).join('|');
    const guards = st.guards.join('>');
    return `${types} :: ${guards}`;
};

const dedupeStates = (arr: State[]): State[] => {
    const seen = new Set<string>();
    const out: State[] = [];
    for (const st of arr) {
        const k = keyOfState(st);
        if (!seen.has(k)) { seen.add(k); out.push(st); }
    }
    return out;
};

const runSequence = (init: State[], prog: readonly Op[], opts: CheckOptions): State[] => {
    let states = init;

    for (let i = 0; i < prog.length; i++) {
        const op = prog[i];
        if (!op) throw new Error("unreachable")

        // Special ops that aren't plain schemas
        if (op.op === 'PUSH_cont') {
            const next: State[] = [];
            for (let si = 0; si < states.length; si++) {
                const st = states[si];
                if (!st) throw new Error("unreachable")
                const stack2 = st.stack.slice();
                stack2.push(tCont(op.body));
                next.push({ stack: stack2, subst: st.subst, guards: st.guards.slice() });
            }
            states = opts.dedupe ? dedupeStates(next) : next;
            continue;
        }

        if (op.op === 'IFELSE') {
            // Order (bottom -> top): i64, cont_else, cont_true
            const next: State[] = [];
            for (let si = 0; si < states.length; si++) {
                const st = states[si];
                if (!st) throw new Error("unreachable")

                const need = 3;
                if (st.stack.length < need) {
                    throw new EffectTypeError('IFELSE', i,
                        new StackUnderflowError(need, st.stack.length, i, 'IFELSE'),
                        si, st.guards);
                }

                const args = st.stack.slice(st.stack.length - need); // [i64, cont_true, cont_else]
                // cond: i64
                try { unify(tBase('i64'), args[0]!, st.subst); }
                catch {
                    throw new EffectTypeError('IFELSE', i,
                        new TypeError(`condition must be i64, got ${showType(applySubst(args[0]!, st.subst))}`),
                        si, st.guards);
                }
                const cElse = applySubst(args[2]!, st.subst);
                const cTrue = applySubst(args[1]!, st.subst);
                if (cElse.tag !== 'cont' || cTrue.tag !== 'cont') {
                    throw new EffectTypeError('IFELSE', i,
                        new TypeError(`expected (cont_true, cont_else) on top of stack, got (${showType(cElse)}, ${showType(cTrue)})`),
                        si, st.guards);
                }
                const base = st.stack.slice(0, st.stack.length - need);

                // true branch
                const stTrueInit: State = { stack: base.slice(), subst: cloneSubst(st.subst), guards: [...st.guards, 'if_true'] };
                const outTrue = runSequence([stTrueInit], cTrue.body, opts);

                // else branch
                const stElseInit: State = { stack: base.slice(), subst: cloneSubst(st.subst), guards: [...st.guards, 'if_false'] };
                const outElse = runSequence([stElseInit], cElse.body, opts);
                next.push(...outTrue, ...outElse);
            }
            states = opts.dedupe ? dedupeStates(next) : next;
            continue;
        }

        if (op.op === 'IF') {
            const next: State[] = [];
            for (let si = 0; si < states.length; si++) {
                const st = states[si];
                if (!st) throw new Error("unreachable")

                // Need top two: i64 (below), cont (top)
                const need = 2;
                if (st.stack.length < need) {
                    throw new EffectTypeError('IF', i, new StackUnderflowError(need, st.stack.length, i, 'IF'), si, st.guards);
                }
                const args = st.stack.slice(st.stack.length - need); // [i64, cont]
                try {
                    // unify cond with i64
                    unify(tBase('i64'), args[0]!, st.subst);
                } catch (e) {
                    throw new EffectTypeError('IF', i, new TypeError(`condition must be i64, got ${showType(applySubst(args[0]!, st.subst))}`), si, st.guards);
                }
                const contVal = applySubst(args[1]!, st.subst);
                if (contVal.tag !== 'cont') {
                    throw new EffectTypeError('IF', i, new TypeError(`expected continuation on top of stack, got ${showType(contVal)}`), si, st.guards);
                }

                // Base stack is everything below those two
                const baseStack = st.stack.slice(0, st.stack.length - need);

                // False path: skip continuation
                next.push({ stack: baseStack.slice(), subst: st.subst, guards: [...st.guards, 'if_false'] });

                // True path: run cont body on base stack
                const trueInit: State = { stack: baseStack.slice(), subst: cloneSubst(st.subst), guards: [...st.guards, 'if_true'] };
                const trueOut = runSequence([trueInit], contVal.body, opts);
                next.push(...trueOut);
            }
            states = opts.dedupe ? dedupeStates(next) : next;
            continue;
        }

        if (op.op === 'UNTIL') {
            const next: State[] = [];
            for (let si = 0; si < states.length; si++) {
                const st = states[si];
                if (!st) throw new Error("unreachable")

                // need top: cont
                const need = 1;
                if (st.stack.length < need) {
                    throw new EffectTypeError('UNTIL', i,
                        new StackUnderflowError(need, st.stack.length, i, 'UNTIL'),
                        si, st.guards);
                }

                const top = applySubst(st.stack[st.stack.length - 1]!, st.subst);
                if (top.tag !== 'cont') {
                    throw new EffectTypeError('UNTIL', i,
                        new TypeError(`expected continuation on top of stack, got ${showType(top)}`),
                        si, st.guards);
                }

                // base stack is below cont
                const base = st.stack.slice(0, st.stack.length - 1);

                // run one iteration of the body on the base stack
                const iterInit: State = { stack: base.slice(), subst: cloneSubst(st.subst), guards: [...st.guards, 'until_body'] };
                const outs = runSequence([iterInit], top.body, opts);

                if (outs.length === 0) {
                    throw new EffectTypeError('UNTIL', i, new TypeError(`loop body produced no states`), si, st.guards);
                }

                for (let oi = 0; oi < outs.length; oi++) {
                    const out = outs[oi];
                    if (!out) throw new Error("unreachable")

                    // body must leave an i64 flag on top
                    if (out.stack.length < 1) {
                        throw new EffectTypeError('UNTIL', i,
                            new TypeError(`loop body must leave an i64 flag on top (got empty stack)`),
                            si, out.guards);
                    }
                    try {
                        unify(tBase('i64'), out.stack[out.stack.length - 1]!, out.subst);
                    } catch {
                        throw new EffectTypeError('UNTIL', i,
                            new TypeError(`loop body must leave i64 flag, got ${showType(applySubst(out.stack[out.stack.length - 1]!, out.subst))}`),
                            si, out.guards);
                    }

                    // pop the flag
                    const post = out.stack.slice(0, out.stack.length - 1);

                    // invariant: post must unify with base (so next iteration is well-typed)
                    try {
                        unifyStacks(post, base, out.subst);
                    } catch (e) {
                        throw new EffectTypeError('UNTIL', i,
                            new TypeError(
                                `loop body must preserve stack shape after popping flag.\n  before: ${showStack(base, out.subst)}\n  after : ${showStack(post, out.subst)}`
                            ),
                            si, out.guards);
                    }

                    // exit effect: stack equals post (now unified with base)
                    next.push({
                        stack: post.map(t => applySubst(t, out.subst)),
                        subst: out.subst,
                        guards: [...out.guards, 'until_exit'],
                    });
                }
            }
            states = opts.dedupe ? dedupeStates(next) : next;
            continue;
        }


        // Regular schema-based op (may have alternatives)
        const schema = makeSchema(op);
        const nextStates: State[] = [];

        for (let si = 0; si < states.length; si++) {
            const st = states[si];
            if (!st) throw new Error("unreachable")

            // 1) Check underflow
            const need = schema.in.length;
            if (st.stack.length < need) {
                throw new EffectTypeError(schema.name, i, new StackUnderflowError(need, st.stack.length, i, schema.name), si, st.guards);
            }

            // 2) Unify inputs
            const args = st.stack.slice(st.stack.length - need); // bottom -> top
            try {
                for (let j = 0; j < need; j++) {
                    unify(schema.in[j]!, args[j]!, st.subst);
                }
                // 3) Extra checks on inputs
                if (schema.check) schema.check(st.subst);
            } catch (e) {
                throw new EffectTypeError(schema.name, i, e, si, st.guards);
            }

            // 4) Spawn alternatives
            for (const alt of schema.alts) {
                const subst2 = cloneSubst(st.subst);
                const stack2 = applyEffect(st.stack, need, alt.out, subst2);
                const guards2 = alt.guard ? [...st.guards, alt.guard] : st.guards.slice();
                nextStates.push({ stack: stack2, subst: subst2, guards: guards2 });
            }
        }

        states = opts.dedupe ? dedupeStates(nextStates) : nextStates;

        // Optional: debug trace
        console.log(`#${i} ${op.op} =>`);
        states.forEach((st, k) => console.log(`  [${k}] ${showStack(st.stack, st.subst)}  guards=[${st.guards.join(',')}]`));
    }

    return states;
};

// ---------- Public API ----------

export const checkProgram = (prog: Op[], opts: CheckOptions = {}): CheckResult => {
    const start: State = { stack: [], subst: new Map(), guards: [] };
    const finalStates = runSequence([start], prog, opts);
    return { finalStates };
};


// ---------- Tiny demo ----------
// Demo 1: IF with a cont that pushes a value
const prog1: Op[] = [
    { op: 'PUSH_i64' },          // condition (type-only here)
    { op: 'PUSH_cont', body: [   // true-branch pushes an i32
        { op: 'PUSH_i32' },
    ] },
    { op: 'IF' },                // false: ∅, true: i32
];

// After IF, trying to DUP would be invalid (since false path has empty stack)
const prog1_bad: Op[] = [
    ...prog1,
    { op: 'DUP' },               // ERROR: not valid for false path
];

// Demo 2: combine with ADDQ inside continuation
const prog2: Op[] = [
    { op: 'PUSH_i64' },
    { op: 'PUSH_cont', body: [
        { op: 'PUSH_byte' },
        { op: 'PUSH_byte' },
        { op: 'ADDQ' },            // alt: i32 | i32 byte (status then maybe result)
    ] },
    { op: 'IF' },                // false: ∅ ; true: i32 | i32 byte
];

const prog3: Op[] = [
    { op: 'PUSH_i32' },
    { op: 'PUSH_f32' },
    { op: 'PUSH_byte' },
    { op: 'PUSH_i64' },
    { op: 'PUSH_cont', body: [ // true branch: push i32
        { op: 'PUSH_k', k: 1 },
    ] },
    { op: 'PUSH_cont', body: [ // else branch: push i32 and DUP
        { op: 'PUSH_k', k: 1 },
    ] },
    { op: 'IFELSE' }, // union of {i32 i32} and {i32}
];

const progUntil: Op[] = [
    { op: 'PUSH_i32' },                    // стартовое значение
    { op: 'PUSH_cont', body: [
        { op: 'DUP' },
        { op: 'ADD' },        // ... i32 -> ... i32
        { op: 'PUSH_i64' },                  // флаг
    ]},
    { op: 'UNTIL' },                       // проверка инварианта: стек после тела (без флага)
];

const run = (label: string, p: Op[]) => {
    try {
        const r = checkProgram(p, { dedupe: true });
        console.log(label);
        r.finalStates.forEach((st, i) => {
            console.log(`  [${i}] ${showStack(st.stack, st.subst)} | guards=[${st.guards.join(',')}]`);
        });
    } catch (e) {
        console.error(label, 'ERROR:', e);
    }
};

// run('Prog1', prog1);
// run('Prog1_bad', prog1_bad);
// run('Prog2', prog2);
run('Prog3', prog3);
// run('progUntil', progUntil);
