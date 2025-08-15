import * as fs from "node:fs"
import {Description, Instruction, Layout, Specification, InstructionSignature} from "../types"
import {instructions, signatureString} from "../instructions"

export interface InstructionEntry {
    readonly name?: string
    readonly description: Description
    readonly signature: InstructionSignature
}

const main = () => {
    const entries: Record<string, InstructionEntry> = {}

    const files = fs.readdirSync(`${__dirname}/../../data`)

    for (const filename of files) {
        const descriptions = JSON.parse(
            fs.readFileSync(`${__dirname}/../../data/${filename}`, "utf8"),
        ) as Record<string, InstructionEntry>

        for (const [name, desc] of Object.entries(descriptions)) {
            entries[name] = desc
        }
    }

    const allInstructions: Record<string, Instruction> = {}

    for (const [name, opcode] of Object.entries(instructions)) {
        if (name.startsWith("f") || name.startsWith("PSEUDO") || name === "DEBUGMARK") {
            continue
        }

        const instr = entries[name]
        if (!instr) {
            throw new Error(`no description for ${name}`)
        }

        const signature = instr.signature
        const signatureStr = signature ? signatureString(signature) : ""

        const layout: Layout = {
            ...opcode,
            // @ts-ignore
            category: undefined,
            subCategory: undefined,
            effects: undefined,
            prefix_str: opcode.prefix.toString(16).toUpperCase(),
        }
        allInstructions[name] = {
            category: opcode.category,
            sub_category: opcode.subCategory,
            description: instr.description,
            layout: layout,
            effects: opcode.effects?.map(it => it.$),
            signature: signature
                ? {
                      stack_string: signatureStr,
                      ...signature,
                  }
                : {},
        }
    }

    const spec: Specification = {
        version: "0.0.1",
        instructions: allInstructions,
    }

    const bigintReplacer = () => (_key: unknown, value: unknown) => {
        if (typeof value === "bigint") {
            return value.toString()
        }
        return value
    }

    fs.writeFileSync(
        `${__dirname}/../../gen/tvm-specification.json`,
        JSON.stringify(spec, bigintReplacer(), 2),
    )
}

void main()
