import * as fs from "node:fs"

interface Spec {
    readonly instructions: Record<string, InstructionData>
}

interface InstructionData {
    name?: string
    readonly category: string
    readonly subCategory: string
    readonly description: object
    readonly layout: object
    readonly signature: {
        readonly stack_string: string
        readonly inputs: object
        readonly outputs: object
    }
}

interface InstructionDescription {
    name?: string
    readonly description: object
    readonly signature: {
        readonly inputs: object
        readonly outputs: object
    }
}

const main = () => {
    const data = JSON.parse(fs.readFileSync(`${__dirname}/tvm-specification.json`, "utf8")) as Spec

    const instructionsByCategory: Map<string, InstructionData[]> = new Map()

    for (const [name, instr] of Object.entries(data.instructions)) {
        instr.name = name
        const category = instr.subCategory ? instr.subCategory : instr.category
        const iss = instructionsByCategory.get(category)
        if (iss === undefined) {
            instructionsByCategory.set(category, [instr])
        } else {
            iss.push(instr)
        }
    }

    instructionsByCategory.forEach((instructions, category) => {
        const outInstructions = instructions.map(
            it =>
                ({
                    name: it.name ?? "",
                    description: it.description,
                    signature: {
                        inputs: it.signature.inputs,
                        outputs: it.signature.outputs,
                    },
                }) satisfies InstructionDescription,
        )
        const mapping: Record<string, InstructionDescription> = {}
        outInstructions.forEach(it => {
            mapping[it.name] = {
                ...it,
                name: undefined,
            }
        })
        fs.writeFileSync(`${__dirname}/data/${category}.json`, JSON.stringify(mapping, null, 2))
    })
}

void main()
