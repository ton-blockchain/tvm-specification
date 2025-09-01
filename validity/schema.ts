import {asBase, freshVar, freshVars, Subst, tBase, TBase, Type} from "./types"
import {Instr} from "ton-assembly/dist/runtime"
import fs from "node:fs"
import {MatchArm, Specification, StackEntry} from "../src/types"

export interface Alt {
    readonly out: Type[];
    readonly guard?: string;
}

/**
 * A schema describes stack inputs/outputs.
 * All arrays are bottom -> top order. Example: [α, α] means two items, top is the last α.
 */
export interface Schema {
    readonly name: string;
    readonly in: Type[];   // bottom -> top
    readonly alts: Alt[];
    readonly check?: (s: Subst) => void; // extra constraints after unification
}

export const isNumeric = (t: TBase): boolean => t.name === "int"

export const SCHEMAS = {
    PUSHINT_4(): Schema {
        return {name: "PUSHINT_4", in: [], alts: [{out: [tBase("int")]}]}
    },
    PUSHINT_8(): Schema {
        return {name: "PUSHINT_8", in: [], alts: [{out: [tBase("int")]}]}
    },
    PUSHINT_16(): Schema {
        return {name: "PUSHINT_16", in: [], alts: [{out: [tBase("int")]}]}
    },
    PUSHINT_LONG(): Schema {
        return {name: "PUSHINT_LONG", in: [], alts: [{out: [tBase("int")]}]}
    },
    PUSH(i: number): Schema {
        if (!Number.isInteger(i) || i < 0) {
            throw new TypeError(`PUSH: i must be non-negative integer, got ${i}`)
        }
        const vs = freshVars(i + 1)         // [α0..αi], αi
        return {
            name: `PUSH s${i}`,
            in: vs,
            alts: [{out: [...vs, vs[vs.length - 1 - i]!]}],
        }
    },
    XCHG_IJ(i: number, j: number): Schema {
        if (!Number.isInteger(i) || !Number.isInteger(j) || i < 0 || j < 0) {
            throw new TypeError(`XCHG_IJ: indices must be non-negative integers, got (${i}, ${j})`)
        }
        const N = Math.max(i, j)
        const m = N + 1
        const vs = freshVars(m, "χ")      // [χ0 .. χN], bottom -> top для среза

        const p_i = m - 1 - i
        const p_j = m - 1 - j

        const out = vs.slice()
        const tmp = out[p_i]!
        out[p_i] = out[p_j]!
        out[p_j] = tmp

        return {
            name: `XCHG_IJ(${i},${j})`,
            in: vs,
            alts: [{out}],
        }
    },
    XCHG_OI(i: number): Schema {
        if (!Number.isInteger(i) || i < 0) {
            throw new TypeError(`XCHG_OI: indices must be non-negative integers, got (${i})`)
        }
        const N = Math.max(i, 0)
        const m = N + 1
        const vs = freshVars(m, "χ")      // [χ0 .. χN], bottom -> top для среза

        const p_i = m - 1 - i
        const p_j = m - 1

        const out = vs.slice()
        const tmp = out[p_i]!
        out[p_i] = out[p_j]!
        out[p_j] = tmp

        return {
            name: `XCHG_OI s${i}`,
            in: vs,
            alts: [{out}],
        }
    },
    XCHG3(i: number, j: number, k: number): Schema {
        if (!Number.isInteger(i) || !Number.isInteger(j) || !Number.isInteger(k) || i < 0) {
            throw new TypeError(`XCHG3: indices must be non-negative integers, got (${i}, ${j}, ${k})`)
        }
        const N = Math.max(i, 0)
        const m = N + 1
        const vs = freshVars(m, "χ")      // [χ0 .. χN], bottom -> top для среза

        const p_i = m - 1 - i
        const p_j = m - 1

        const out = vs.slice()
        const tmp = out[p_i]!
        out[p_i] = out[p_j]!
        out[p_j] = tmp

        return {
            name: `XCHG3 s${i} s${j} s${k}`,
            in: vs,
            alts: [{out}],
        }
    },
    POP(): Schema {
        const a = freshVar("α")
        return {name: "POP", in: [a], alts: [{out: []}]}
    },
    NIP(): Schema {
        const a = freshVar("α")
        const b = freshVar("β")
        return {name: "NIP", in: [a, b], alts: [{out: [b]}]}
    },
    DUP(): Schema {
        const a = freshVar("α")
        return {name: "DUP", in: [a], alts: [{out: [a, a]}]}
    },
    SWAP(): Schema {
        const a = freshVar("α")
        const b = freshVar("β")
        return {name: "SWAP", in: [a, b], alts: [{out: [b, a]}]}
    },
    ADD(): Schema {
        const a = freshVar("α")
        return {
            name: "ADD",
            in: [a, a],
            alts: [{out: [a]}],
            check: (s: Subst) => {
                const aa = asBase(a, s)
                if (!isNumeric(aa)) {
                    throw new TypeError(`ADD expects numeric types, got ${aa.name}`)
                }
            },
        }
    },
}

const spec = JSON.parse(
    fs.readFileSync(`${__dirname}/../gen/tvm-specification.json`, "utf8"),
) as Specification

function findInstruction(spec: Specification, name: string) {
    return spec.instructions[name] ?? spec.instructions[name.replace("_", "#")]
}

function signatureValueToType(entry: StackEntry): Type {
    if (entry.type !== "simple") {
        throw new Error(`not supported yet: ${entry.type}`)
    }

    const valueType = entry.value_types?.[0]
    if (valueType === "Int" || valueType === "Bool") {
        return tBase("int")
    }
    if (valueType === "Cell") {
        return tBase("cell")
    }
    if (valueType === "Slice") {
        return tBase("slice")
    }
    if (valueType === "Builder") {
        return tBase("builder")
    }
    if (valueType === "Tuple") {
        return tBase("tuple")
    }

    if (valueType === undefined) {
        return tBase("any")
    }

    throw new Error(`not supported yet: ${valueType}`)
}


export const makeSchema = (op: Instr): Schema => {
    switch (op.$) {
        case "PUSHINT_4":
            return SCHEMAS.PUSHINT_4()
        case "PUSHINT_8":
            return SCHEMAS.PUSHINT_8()
        case "PUSHINT_16":
            return SCHEMAS.PUSHINT_16()
        case "PUSHINT_LONG":
            return SCHEMAS.PUSHINT_LONG()
        case "PUSH":
            return SCHEMAS.PUSH(op.arg0)
        case "XCHG_IJ":
            return SCHEMAS.XCHG_IJ(op.arg0, op.arg1)
        case "XCHG_0I":
            return SCHEMAS.XCHG_OI(op.arg0)
        case "XCHG3":
            return SCHEMAS.XCHG3(op.arg0)
        case "POP":
            return SCHEMAS.POP()
        case "NIP":
            return SCHEMAS.NIP()
        case "DUP":
            return SCHEMAS.DUP()
        case "SWAP":
            return SCHEMAS.SWAP()
        case "ADD":
            return SCHEMAS.ADD()
        default:
            const instrInfo = findInstruction(spec, op.$)

            if (instrInfo) {
                const inputs = instrInfo?.signature?.inputs?.stack ?? []
                const outputs = instrInfo?.signature?.outputs?.stack ?? []

                const inputsVars = inputs.map(it => signatureValueToType(it))

                if (outputs[0]?.type === "conditional") {
                    const output = outputs[0]
                    const stacks = output.match.map((arm: MatchArm): Alt => {
                        return {
                            guard: `${output.name} == ${arm.value}`,
                            out: arm.stack.map(it => signatureValueToType(it)),
                        }
                    })

                    const otherOutputs = outputs.slice(1)
                    const finalStacks = stacks.map((alt): Alt => ({
                        guard: alt.guard,
                        out: [...alt.out, ...otherOutputs.map(it => signatureValueToType(it))],
                    }))

                    return {
                        name: op.$,
                        in: inputsVars,
                        alts: finalStacks,
                    }
                }

                const outputVarsVars = outputs.map(it => signatureValueToType(it))

                return {
                    name: op.$,
                    in: inputsVars,
                    alts: [{
                        out: outputVarsVars,
                    }],
                }
            }

            throw new Error(`No schema for op ${(op as any).$}`)
    }
}
