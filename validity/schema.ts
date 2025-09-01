import {asBase, freshVar, freshVars, Subst, tBase, TBase, Type} from "./types"
import {Instr} from "ton-assembly/dist/runtime"
import fs from "node:fs"
import {MatchArm, Specification, StackEntry} from "../src/types"

export interface Alt {
    readonly out: Type[]
    readonly guard?: string
}

/**
 * A schema describes stack inputs/outputs.
 * All arrays are bottom -> top order. Example: [α, α] means two items, top is the last α.
 */
export interface Schema {
    readonly name: string
    readonly in: Type[] // bottom -> top
    readonly alts: Alt[]
    readonly check?: (s: Subst) => void // extra constraints after unification
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
        const vs = freshVars(i + 1) // [α0..αi], αi
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
        const vs = freshVars(m, "χ") // [χ0 .. χN], bottom -> top для среза

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
        const vs = freshVars(m, "χ") // [χ0 .. χN], bottom -> top для среза

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
        if (
            !Number.isInteger(i) ||
            !Number.isInteger(j) ||
            !Number.isInteger(k) ||
            i < 0 ||
            j < 0 ||
            k < 0
        ) {
            throw new TypeError(
                `XCHG3: indices must be non-negative integers, got (${i}, ${j}, ${k})`,
            )
        }

        // Находим максимальный индекс для определения размера стека
        const N = Math.max(i, j, k, 2) // минимум 3 элемента (s0, s1, s2)
        const m = N + 1
        const vs = freshVars(m, "χ") // [χ0 .. χN], bottom -> top

        const out = vs.slice()

        // Выполняем последовательность обменов как описано в спецификации:
        // s2 s(i) XCHG, s1 s(j) XCHG, s(k) XCHG0

        // s2 s(i) XCHG
        const p_2 = m - 1 - 2 // позиция s2
        const p_i = m - 1 - i // позиция s(i)
        if (p_2 !== p_i) {
            const tmp = out[p_2]!
            out[p_2] = out[p_i]!
            out[p_i] = tmp
        }

        // s1 s(j) XCHG
        const p_1 = m - 1 - 1 // позиция s1
        const p_j = m - 1 - j // позиция s(j)
        if (p_1 !== p_j) {
            const tmp = out[p_1]!
            out[p_1] = out[p_j]!
            out[p_j] = tmp
        }

        // s(k) XCHG0
        const p_0 = m - 1 // позиция s0 (top)
        const p_k = m - 1 - k // позиция s(k)
        if (p_0 !== p_k) {
            const tmp = out[p_0]!
            out[p_0] = out[p_k]!
            out[p_k] = tmp
        }

        return {
            name: `XCHG3 s${i} s${j} s${k}`,
            in: vs,
            alts: [{out}],
        }
    },
    XCPU(i: number, j: number): Schema {
        if (!Number.isInteger(i) || !Number.isInteger(j) || i < 0 || j < 0) {
            throw new TypeError(`XCPU: indices must be non-negative integers, got (${i}, ${j})`)
        }

        // Находим максимальный индекс для определения размера стека
        const N = Math.max(i, j)
        const m = N + 1
        const vs = freshVars(m, "χ") // [χ0 .. χN], bottom -> top

        const out = vs.slice()

        // Выполняем последовательность операций:
        // 1. s(i) XCHG0 - обменяем i-й элемент с верхним (s0)
        const p_0 = m - 1 // позиция s0 (top)
        const p_i = m - 1 - i // позиция s(i)
        if (p_0 !== p_i) {
            const tmp = out[p_0]!
            out[p_0] = out[p_i]!
            out[p_i] = tmp
        }

        // 2. s(j) PUSH - пушим j-й элемент на верх стека
        const p_j = m - 1 - j // позиция s(j)
        const elementToPush = out[p_j]!
        out.push(elementToPush)

        return {
            name: `XCPU s${i} s${j}`,
            in: vs,
            alts: [{out}],
        }
    },
    XCHG2(i: number, j: number): Schema {
        if (!Number.isInteger(i) || !Number.isInteger(j) || i < 0 || j < 0) {
            throw new TypeError(`XCHG2: indices must be non-negative integers, got (${i}, ${j})`)
        }

        // Находим максимальный индекс для определения размера стека
        // Нужно минимум 2 элемента для s1 и s0
        const N = Math.max(i, j, 1)
        const m = N + 1
        const vs = freshVars(m, "χ") // [χ0 .. χN], bottom -> top

        const out = vs.slice()

        // Выполняем последовательность операций:
        // 1. s1 s(i) XCHG - обменяем второй элемент (s1) с i-м элементом
        const p_1 = m - 1 - 1 // позиция s1
        const p_i = m - 1 - i // позиция s(i)
        if (p_1 !== p_i) {
            const tmp = out[p_1]!
            out[p_1] = out[p_i]!
            out[p_i] = tmp
        }

        // 2. s(j) XCHG0 - обменяем j-й элемент с верхним (s0)
        const p_0 = m - 1 // позиция s0 (top)
        const p_j = m - 1 - j // позиция s(j)
        if (p_0 !== p_j) {
            const tmp = out[p_0]!
            out[p_0] = out[p_j]!
            out[p_j] = tmp
        }

        return {
            name: `XCHG2 s${i} s${j}`,
            in: vs,
            alts: [{out}],
        }
    },
    XCHG_1I(i: number): Schema {
        if (!Number.isInteger(i) || i < 0) {
            throw new TypeError(`XCHG_1I: index must be non-negative integer, got ${i}`)
        }

        // Нужно минимум 2 элемента (s0 и s1), плюс элемент на позиции i
        const N = Math.max(i, 1)
        const m = N + 1
        const vs = freshVars(m, "χ") // [χ0 .. χN], bottom -> top

        const out = vs.slice()

        // Обменяем второй элемент (s1) с i-м элементом
        const p_1 = m - 1 - 1 // позиция s1
        const p_i = m - 1 - i // позиция s(i)

        if (p_1 !== p_i) {
            const tmp = out[p_1]!
            out[p_1] = out[p_i]!
            out[p_i] = tmp
        }

        return {
            name: `XCHG_1I s${i}`,
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

    if (valueType === undefined || valueType === "Any") {
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
        case "XCHG_1I":
            return SCHEMAS.XCHG_1I(op.arg1)
        case "XCHG3":
            return SCHEMAS.XCHG3(op.arg0, op.arg1, op.arg2)
        case "XCPU":
            return SCHEMAS.XCPU(op.arg0, op.arg1)
        case "XCHG2":
            return SCHEMAS.XCHG2(op.arg0, op.arg1)
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
                    const finalStacks = stacks.map(
                        (alt): Alt => ({
                            guard: alt.guard,
                            out: [...alt.out, ...otherOutputs.map(it => signatureValueToType(it))],
                        }),
                    )

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
                    alts: [
                        {
                            out: outputVarsVars,
                        },
                    ],
                }
            }

            throw new Error(`No schema for op ${(op as any).$}`)
    }
}
