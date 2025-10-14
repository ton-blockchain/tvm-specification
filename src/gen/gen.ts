import * as fs from "node:fs"
import {
    Description,
    Instruction,
    Layout,
    Specification,
    InstructionSignature,
    FiftInstruction,
    ControlFlowOfInstruction,
} from "../types"
import {
    instructions,
    signatureString,
    calculateGasConsumptionWithDescription,
} from "../instructions"

export interface InstructionEntry {
    readonly name?: string
    readonly description: Description
    readonly signature: InstructionSignature
    readonly control_flow?: ControlFlowOfInstruction
}

const main = () => {
    const entries: Record<string, InstructionEntry> = {}

    const files = fs.readdirSync(`${__dirname}/../../data`)

    for (const filename of files) {
        if (filename === "fift") continue

        const descriptions = JSON.parse(
            fs.readFileSync(`${__dirname}/../../data/${filename}`, "utf8"),
        ) as Record<string, InstructionEntry>

        for (const [name, desc] of Object.entries(descriptions)) {
            entries[name] = desc
        }
    }

    let implementationMapping: Record<string, any> = {}
    const implementationsPath = `${__dirname}/../../.tmp/implementations.json`
    if (fs.existsSync(implementationsPath)) {
        try {
            implementationMapping = JSON.parse(fs.readFileSync(implementationsPath, "utf-8"))
            console.log(
                `Loaded ${Object.keys(implementationMapping).length} implementation mappings`,
            )
        } catch (error) {
            console.warn("Failed to load implementations.json:", error)
        }
    } else {
        console.error("implementations.json not found, forget to run `yarn find-implementations`?")
        process.exit(1)
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

        const gasCosts = calculateGasConsumptionWithDescription(opcode).filter(
            it => it.value !== 36,
        )

        allInstructions[name] = {
            category: opcode.category,
            sub_category: opcode.subCategory,
            description: {
                ...instr.description,
                gas: gasCosts.length > 0 ? gasCosts : undefined,
            },
            layout: layout,
            effects: opcode.effects?.map(it => it.$),
            signature: signature
                ? {
                      stack_string: signatureStr,
                      ...signature,
                  }
                : undefined,
            control_flow: instr.control_flow,
            implementation: implementationMapping[name],
        }
    }

    const fiftInstructions = JSON.parse(
        fs.readFileSync(`${__dirname}/../../data/fift/fift-instructions.json`, "utf8"),
    ) as Record<string, FiftInstruction>

    validateFiftInstructions(fiftInstructions, allInstructions)

    const version = JSON.parse(fs.readFileSync(`${__dirname}/../../package.json`, "utf8")).version

    const spec: Specification = {
        $schema: "./schema.json",
        version,
        instructions: allInstructions,
        fift_instructions: fiftInstructions,
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

const validateFiftInstructions = (
    fiftInstructions: Record<string, FiftInstruction>,
    allInstructions: Record<string, Instruction>,
) => {
    for (const [name, instr] of Object.entries(fiftInstructions)) {
        if (Object.keys(instructions).includes(name)) {
            throw new Error(`Alias name ${name} is actual instruction name`)
        }

        if (instr.actual_name === "none") continue

        if (!Object.keys(instructions).includes(instr.actual_name)) {
            throw new Error(`Aliased instruction ${instr.actual_name} doesn't exist`)
        }

        const aliasedInstr = allInstructions[instr.actual_name]
        if (!aliasedInstr) {
            throw new Error(`Aliased instruction ${instr.actual_name} doesn't exist`)
        }

        if (instr.arguments) {
            if (instr.arguments.length !== aliasedInstr.description.operands.length) {
                throw new Error(
                    `Count operands mismatch for ${name}:\n  alias: ${instr.arguments.length}\n  instr: ${aliasedInstr.description.operands.length}`,
                )
            }
        }
    }
}

void main()
