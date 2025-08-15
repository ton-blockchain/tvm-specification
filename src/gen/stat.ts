import * as fs from "node:fs"
import {Specification} from "../types"

interface Stats {
    count: number
    withExitCodes: number
    withExamples: number
    withOtherImplementations: number
    withoutAnyTextDescription: number
    withoutAEmptySignature: number
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
        withoutAEmptySignature: 0,
    }

    for (const [, instr] of Object.entries(data.instructions)) {
        stats.count++
        if (instr.description.short === "" && instr.description.long === "") {
            stats.withoutAnyTextDescription++
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
        if (!instr.signature.inputs?.stack?.length && !instr.signature.outputs?.stack?.length) {
            stats.withoutAEmptySignature++
        }
    }

    console.log(`- Instructions count: **${stats.count}**`)
    console.log(`- With exit code description: **${stats.withExitCodes}**`)
    console.log(`- With examples: **${stats.withExamples}**`)
    console.log(`- With other implementations description: **${stats.withOtherImplementations}**`)
    console.log(`- Without any text description: **${stats.withoutAnyTextDescription}**`)
    console.log(`- With empty stack signature: **${stats.withoutAEmptySignature}**`)
}

void main()
