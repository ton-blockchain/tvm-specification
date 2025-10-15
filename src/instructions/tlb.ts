import {Opcode, arg as Arg} from "./instructions"

export function generateTlb(
    name: string,
    instruction: Opcode,
    operandNames: readonly string[] = [],
    includeNames: boolean = true,
): string {
    let result = ""

    const nextVariableName = () => {
        const names = ["i", "j", "k"]
        let index = 0
        return () => {
            if (operandNames.length > 0 && index < operandNames.length) {
                const name = operandNames[index]
                index++
                return name
            }

            const name = names[index]
            index++
            return name
        }
    }
    const variableNameGenerator = nextVariableName()

    let opcode = instruction.prefix
    if (instruction.kind === "fixed-range" || instruction.kind === "ext-range") {
        opcode = instruction.prefix >> (instruction.skipLen - instruction.checkLen)
    }

    if (includeNames) {
        const baseName = name.toLowerCase()
        if (baseName.startsWith("2")) {
            result += `_${baseName}`
        } else if (baseName.includes("#")) {
            result += baseName.replace(/#/g, "_")
        } else {
            result += baseName
        }
    }

    result += "#" + opcode.toString(16) + " "

    function generateArg(rawArg: Arg) {
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
                if (refs.$ === "uint") {
                    const restriction = refs.range.min !== 0n ? ` { ${refs.range.min} <= r }` : ""
                    result += `r: (## ${refs.len})${restriction} `
                }
                const bits = unwrapDelta(arg.bits)
                if (bits.$ === "uint") {
                    const restriction =
                        bits.range.min !== 0n ? ` { ${bits.range.min} <= bits }` : ""
                    result += `bits: (## ${bits.len})${restriction} `
                }

                if (refs.$ === "uint") {
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
                    const restriction = refs.range.min !== 0n ? ` { ${refs.range.min} <= r }` : ""
                    result += `r: (## ${refs.len})${restriction} `
                }
                const bits = unwrapDelta(arg.bits)
                if (bits.$ === "uint") {
                    const restriction =
                        bits.range.min !== 0n ? ` { ${bits.range.min} <= bits }` : ""
                    result += `bits: (## ${bits.len})${restriction} `
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
                    const restriction =
                        bits.range.min !== 0n ? ` { ${bits.range.min} <= bits }` : ""
                    result += `bits:(## ${bits.len})${restriction} `
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
            case "runvmArg": {
                result += "flags: (## 12)"
                break
            }
            case "refs": {
                // processed in a slice branch
                break
            }
            case "delta": {
                generateArg(arg.arg)
                break
            }
            case "plduzArg": {
                result += "i: (## 3)"
                break
            }
            case "tinyInt": {
                result += "i: (## 4)"
                break
            }
            case "largeInt": {
                result += "len: (## 5) data: (int (8 * l + 19))"
                break
            }
            case "hash": {
                const name = variableNameGenerator() ?? "i"
                result += `${name}: (## 8)`
                break
            }
            case "minusOne": {
                const name = variableNameGenerator()
                result += `${name}: (## 4) `
                break
            }
            case "debugstr": {
                result += "bits: (## 4) data: ((8 * bits + 8) * Bit) "
                break
            }
            case "s1":
            case "setcpArg":
            case "exoticCell": {
                break
            }
        }
    }

    if (name === "XCHG_IJ") {
        result += "i: (## 4) j: (## 4) { 1 <= i } { i + 1 <= j }"
    } else if (instruction.args.$ === "simpleArgs") {
        for (const arg of instruction.args.children) {
            generateArg(arg)
        }
    } else if (instruction.args.$ === "dictpush") {
        result += "d: ^Cell key_len: (## 10)"
    }

    if (includeNames) {
        result += "= "

        if (name.startsWith("2")) {
            result += `_${name}`
        } else if (name.includes("#")) {
            result += name.replace(/#/g, "_")
        } else {
            result += name
        }
        result += ";"
    } else {
        result = result.trim()
    }

    return result
}

function unwrapDelta(arg: Arg): Arg {
    if (arg.$ === "delta") {
        return unwrapDelta(arg.arg)
    }
    return arg
}
