import {Instr} from "ton-assembly/dist/runtime"

export type BaseName = "int" | "slice" | "cell" | "builder" | "tuple" | "any" | "null"

export interface TBase {
    readonly tag: "base"
    readonly name: BaseName
}
export interface TVar {
    readonly tag: "var"
    readonly id: number
    readonly hint?: string
}
export interface TCont {
    readonly tag: "cont"
    readonly body: readonly Instr[]
}
export type Type = TBase | TVar | TCont

export const tBase = (name: BaseName): TBase => ({tag: "base", name})
export const tCont = (body: readonly Instr[]): TCont => ({tag: "cont", body})

let VAR_COUNTER = 0
export const freshVar = (hint?: string): TVar => ({tag: "var", id: ++VAR_COUNTER, hint})

export const freshVars = (n: number, prefix = "τ"): TVar[] =>
    Array.from({length: n}, (_, i) => freshVar(`${prefix}${i}`))

export const showType = (t: Type): string => {
    if (t.tag === "base") return t.name
    if (t.tag === "cont") return "cont"
    return t.hint ? `${t.hint}${t.id}` : `α${t.id}`
}

/** Map var-id -> Type (can point to base or another var). */
export type Subst = Map<number, Type>

export const cloneSubst = (s: Subst): Subst => new Map(s)

/** Deref through the substitution until we reach a non-var or an unbound var. */
export const deref = (t: Type, s: Subst): Type => {
    if (t.tag === "var") {
        const seen = new Set<number>()
        let cur: Type = t
        while (cur.tag === "var") {
            if (seen.has(cur.id)) break // cycle guard (shouldn't happen here)
            seen.add(cur.id)
            const next = s.get(cur.id)
            if (!next) break
            cur = next
        }
        return cur
    }
    return t
}

/** Bind variable v to type t (t may be var or base). */
const bindVar = (v: TVar, t: Type, s: Subst) => {
    // trivial: α = α
    const tt = deref(t, s)
    if (tt.tag === "var" && tt.id === v.id) return
    s.set(v.id, tt)
}

/** Unify two types under substitution s. */
export const unify = (a: Type, b: Type, s: Subst) => {
    const aa = deref(a, s)
    const bb = deref(b, s)
    if (aa.tag === "var") return bindVar(aa, bb, s)
    if (bb.tag === "var") return bindVar(bb, aa, s)

    // cont vs cont (we ignore body equality here)
    if (aa.tag === "cont" && bb.tag === "cont") return

    if (aa.tag === "base" && bb.tag === "base") {
        if (aa.name === "any" || bb.name === "any") return // allow any
        // both base
        if (aa.name !== bb.name) {
            throw new TypeError(`Type mismatch: ${aa.name} vs ${bb.name}`)
        }
        return
    }

    throw new TypeError(`Type mismatch: ${showType(aa)} vs ${showType(bb)}`)
}

/** Apply substitution to a type (one step of deref). */
export const applySubst = (t: Type, s: Subst): Type => deref(t, s)

/** Require that a type is a concrete base (after substitution). */
export const asBase = (t: Type, s: Subst): TBase => {
    const tt = deref(t, s)
    if (tt.tag !== "base") {
        throw new TypeError(`Type must be concrete, got ${showType(tt)}`)
    }
    return tt
}
