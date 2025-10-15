import {arg as Arg, Opcode} from "./instructions"

export function generateTlb(instruction: Opcode, operandNames: readonly string[]): string {
    let result = ""

    const nextVariableName = () => {
        let index = 0
        return () => {
            const name = operandNames[index]
            index++
            return name
        }
    }
    const variableNameGenerator = nextVariableName()

    let opcode = instruction.prefix
    if (instruction.kind === "fixed-range" || instruction.kind === "ext-range") {
        opcode = instruction.prefix >> (instruction.skipLen - instruction.checkLen)
    }

    result += "#" + opcode.toString(16) + " "

    for (const rawArg of instruction.args) {
        const arg = unwrapDelta(rawArg)

        switch (arg.$) {
            case "int": {
                const name = variableNameGenerator()
                result += `${name}: int${arg.len} `
                break
            }
            case "uint":
            case "stack": {
                const name = variableNameGenerator()
                const restriction = arg.range.min !== 0n ? ` { ${arg.range.min} <= ${name} }` : ""
                result += `${name}: (## ${arg.len})${restriction} `
                break
            }
            case "control": {
                const name = variableNameGenerator()
                result += `${name}: (## 4) `
                break
            }
            case "slice": {
                const refs = unwrapDelta(arg.refs)
                if (refs.$ === "uint" && refs.len !== 0) {
                    result += `r: (## ${refs.len}) `
                }
                const bits = unwrapDelta(arg.bits)
                if (bits.$ === "uint") {
                    result += `bits: (## ${bits.len}) `
                }

                if (refs.$ === "uint" && refs.len !== 0) {
                    let delta = 0
                    if (arg.refs.$ === "delta") {
                        delta = arg.refs.delta
                    }

                    result += delta === 0 ? "refs: (r * ^Cell) " : `refs: ((r + ${delta}) * ^Cell) `
                }

                result += `data: ((8 * bits + ${arg.pad}) * Bit) `
                break
            }
            case "codeSlice": {
                const refs = unwrapDelta(arg.refs)
                if (refs.$ === "uint") {
                    result += `r: (## ${refs.len}) `
                }
                const bits = unwrapDelta(arg.bits)
                if (bits.$ === "uint") {
                    result += `bits: (## ${bits.len}) `
                }

                let delta = 0
                if (arg.refs.$ === "delta") {
                    delta = arg.refs.delta
                }
                result += delta === 0 ? "refs: (r * ^Cell) " : `refs: ((r + ${delta}) * ^Cell) `
                result += "data: ((8 * bits) * Bit) "
                break
            }
            case "inlineCodeSlice": {
                const bits = unwrapDelta(arg.bits)
                if (bits.$ === "uint") {
                    result += `bits:(## ${bits.len}) `
                }

                const name = variableNameGenerator() ?? "data"
                result += `${name}: ((8 * bits) * Bit) `
                break
            }
            case "refCodeSlice": {
                const name = variableNameGenerator() ?? "ref"
                result += `${name}: ^Cell `
                break
            }
            case "plduzArg": {
                const name = variableNameGenerator() ?? "i"
                result += `${name}: (## 3) `
                break
            }
            case "tinyInt": {
                const name = variableNameGenerator() ?? "i"
                result += `${name}: (## 4) `
                break
            }
            case "largeInt": {
                result += "len: (## 5) data: (int (8 * l + 19))"
                break
            }
            case "debugstr": {
                result += "bits: (## 4) data: ((8 * bits + 8) * Bit) "
                break
            }
            case "dict": {
                const name = variableNameGenerator() ?? "d"
                result += `${name}: ^Cell `
                break
            }
            case "delta":
            case "minusOne":
            case "s1":
            case "setcpArg":
            case "exoticCell": {
                break
            }
        }
    }

    return result.trim()
}

function unwrapDelta(arg: Arg): Arg {
    if (arg.$ === "delta") {
        return unwrapDelta(arg.arg)
    }
    return arg
}
