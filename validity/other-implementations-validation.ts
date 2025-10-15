/**
 * This file contains the logic for validating other_implementations.
 * It checks that the instructions listed in other_implementations can be compiled together.
 */

import * as fs from "node:fs"
import {Instruction, Specification} from "../src/types"
import {text} from "ton-assembly"

const colors = {
    green: "\x1b[32m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
    reset: "\x1b[0m",
} as const

function canCompileInstructions(instructions: readonly string[]): {
    success: boolean
    error?: string
} {
    const processedInstructions = instructions.map(instr =>
        instr
            .replace("#", "_")
            .replace(/s\(\w+\+\d+\)/g, "s2")
            .replace(/s\(\w+-\d+\)/g, "s2")
            .replace(/s\(\w+\)/g, "s2")
            .replace(/c\(\w+\)/g, "c1")
            .replace(/\[num]/g, "3")
            .replace(/\[r]/g, "4")
            .replace(/\[n]/g, "5")
            .replace(/\[i]/g, "6")
            .replace(/\[j]/g, "7")
            .replace(/\[k]/g, "8")
            .replace(/\[width]/g, "9")
            .replace(/\[c]/g, "{}")
            .replace(/\[ref]/g, "{}")
            .replace(/\[body]/g, "{}")
            .replace(/\[else]/g, "{}")
            .replace(/\[x]/g, "10")
            .replace(/\[i\+j]/g, "5")
            .replace(/\[i\+j\+\d+]/g, "5")
            .replace(/\[(\w)\+\d+]/g, "2"),
    )
    const code = processedInstructions.join("\n")
    const res = text.parse("other-impl.tasm", code)
    if (res.$ === "ParseFailure") {
        return {success: false, error: `For:\n${code}\n\nError: ` + res.error.msg}
    }
    return {success: true}
}

async function checkOtherImplementations(
    instructionName: string,
    otherImplementations: Instruction["description"]["other_implementations"],
): Promise<boolean> {
    if (!otherImplementations || otherImplementations.length === 0) {
        return true
    }

    debugLog(
        `Validating ${otherImplementations.length} other implementation(s) for ${colors.yellow}${instructionName}${colors.reset}`,
    )

    let allValid = true
    for (let i = 0; i < otherImplementations.length; i++) {
        const otherImpl = otherImplementations[i]!
        const instructions = otherImpl.instructions

        try {
            const result = canCompileInstructions(instructions)
            if (result.success) {
                console.log(
                    `${colors.green}✓${colors.reset} Other implementation ${i + 1} for ${colors.yellow}${instructionName}${colors.reset} compiles successfully`,
                )
            } else {
                console.error(
                    `${colors.red}✗${colors.reset} Other implementation ${i + 1} for ${colors.yellow}${instructionName}${colors.reset} failed to compile: ${result.error}`,
                )
                debugLog("Instructions:", instructions)
                allValid = false
            }
        } catch (e) {
            console.error(
                `${colors.red}✗${colors.reset} Other implementation ${i + 1} for ${colors.yellow}${instructionName}${colors.reset} threw exception during compilation:`,
                e,
            )
            debugLog("Instructions:", instructions)
            allValid = false
        }
    }

    return allValid
}

async function main() {
    const spec = JSON.parse(
        fs.readFileSync(`${__dirname}/../gen/tvm-specification.json`, "utf8"),
    ) as Specification

    let totalInstructions = 0
    let instructionsWithOtherImpl = 0
    let totalOtherImplGroups = 0
    let validatedOtherImplGroups = 0
    let hasValidationErrors = false

    for (const instruction of spec.instructions) {
        const name = instruction.name
        totalInstructions++

        const otherImplementations = instruction.description?.other_implementations
        if (!otherImplementations || otherImplementations.length === 0) {
            continue
        }

        instructionsWithOtherImpl++
        totalOtherImplGroups += otherImplementations.length

        debugLog(`\nValidating ${otherImplementations.length} other implementation(s) for ${name}`)

        const isValid = await checkOtherImplementations(name, otherImplementations)
        if (isValid) {
            validatedOtherImplGroups += otherImplementations.length
        } else {
            hasValidationErrors = true
        }
    }

    console.log("")
    console.log(`Total instructions processed: ${totalInstructions}`)
    console.log(`Instructions with other_implementations: ${instructionsWithOtherImpl}`)
    console.log(`Total other_implementation groups: ${totalOtherImplGroups}`)
    console.log(`Successfully validated other_implementation groups: ${validatedOtherImplGroups}`)

    if (hasValidationErrors) {
        console.error(`\n${colors.red}Some other_implementations failed validation!${colors.reset}`)
        process.exit(1)
    } else {
        console.log(
            `\n${colors.green}All other_implementations validated successfully!${colors.reset}`,
        )
    }
}

function debugLog(...args: unknown[]) {
    if (process.env["DEBUG"]) {
        console.log(...args)
    }
}

void main()
