import * as fs from "node:fs"
import {Specification} from "../types"

interface Stats {
    count: number
    withExitCodes: number
    withExamples: number
    withOtherImplementations: number
    withoutAnyTextDescription: number
    withoutAnyTextDescriptionFull: number
    withoutAEmptySignature: number
    fiftInstructions: number
}

const main = () => {
    const data = JSON.parse(
        fs.readFileSync(`${__dirname}/../../gen/tvm-specification.json`, "utf8"),
    ) as Specification

    const stats: Stats = {
        count: 0,
        withExitCodes: 0,
        withExamples: 0,
        withOtherImplementations: 0,
        withoutAnyTextDescription: 0,
        withoutAnyTextDescriptionFull: 0,
        withoutAEmptySignature: 0,
        fiftInstructions: Object.keys(data.fift_instructions).length,
    }

    const verifiedInstructionsWithEmptyStackSignature: Set<string> = new Set([
        "UNTILEND",
        "AGAINEND",
        "NOP",
        "CALLREF",
        "JMPREF",
        "JMPREFDATA",
        "DEBUGSTR",
        "THROW_SHORT",
        "THROW",
        "DUMPSTK",
        "DEBUG",
        "DEBUG_1",
        "DUMP",
        "DEBUG_2",
        "SETCP",
        "SETCP_SHORT",
        "ACCEPT",
        "COMMIT",
        "RETURNARGS",
    ])

    for (const [name, instr] of Object.entries(data.instructions)) {
        stats.count++
        if (instr.description.short === "" && instr.description.long === "") {
            if (instr.category !== "arithmetic") {
                stats.withoutAnyTextDescription++
            }
            stats.withoutAnyTextDescriptionFull++
        }
        if (instr.description.exit_codes?.length) {
            stats.withExitCodes++
        }
        if (instr.description.examples) {
            stats.withExamples++
        }
        if (instr.description.other_implementations) {
            stats.withOtherImplementations++
        }
        if (
            instr.signature &&
            !instr.signature.inputs?.stack?.length &&
            !instr.signature.inputs?.registers?.length &&
            !instr.signature.outputs?.stack?.length &&
            !instr.signature.outputs?.registers?.length &&
            !verifiedInstructionsWithEmptyStackSignature.has(name)
        ) {
            stats.withoutAEmptySignature++
        }
    }

    console.log(`- Instructions count: **${stats.count}**`)
    console.log(`- With exit code description: **${stats.withExitCodes}**`)
    console.log(`- With examples: **${stats.withExamples}**`)
    console.log(`- With other implementations description: **${stats.withOtherImplementations}**`)
    console.log(
        `- Without any text description: **${stats.withoutAnyTextDescription}**, including arithmetic: **${stats.withoutAnyTextDescriptionFull}**`,
    )
    console.log(`- With unverified empty stack signature: **${stats.withoutAEmptySignature}**`)
    console.log(`- Fift instructions count: **${stats.fiftInstructions}**`)
}

void main()
