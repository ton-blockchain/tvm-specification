/**
 * This file contains the logic for validating examples from the specification.
 * It checks that the stack state after executing the example instructions
 * matches the expected output stack state.
 */

import {executeInstructions} from "./execute"
import {DROP, Instr} from "ton-assembly/dist/runtime"
import {print} from "ton-assembly/dist/text/printer"
import {parse} from "ton-assembly/dist/text/parse"
import * as fs from "node:fs"
import {Instruction, Example} from "../src/types"
import {GetMethodError} from "@ton/sandbox"

const colors = {
    green: "\x1b[32m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
    reset: "\x1b[0m",
} as const

function generateInstructionsFromExample(exampleInstructions: Example["instructions"]): Instr[] {
    const lines = exampleInstructions.map(it => it.instruction)
    const code = lines.join("\n")
    const res = parse("example.tasm", code)
    if (res.$ === "ParseFailure") {
        throw new Error(`cannot parse example instructions: ${res.error.msg}, code: ${code}`)
    }
    return res.instructions
}

async function checkExample(
    instructionName: string,
    example: Example,
    exampleIndex: number,
): Promise<boolean> {
    const expectedExitCode = example.exit_code ?? 0
    const expectsException = expectedExitCode !== 0

    try {
        const instructions = generateInstructionsFromExample(example.instructions)

        debugLog(
            `Validating example ${exampleIndex + 1} for ${colors.yellow}${instructionName}${colors.reset}`,
        )
        debugLog(
            "Instructions:",
            example.instructions.map(i => i.instruction),
        )
        debugLog("Expected input stack:", example.stack.input)
        debugLog("Expected output stack:", example.stack.output)
        debugLog("Expected exit code:", expectedExitCode)

        const assembly = print(instructions)
        debugLog("Generated assembly:", assembly)

        const [reader] = await executeInstructions([DROP(), ...instructions], 0)

        if (expectsException) {
            console.error(
                `${colors.red}✗${colors.reset} Example ${exampleIndex + 1} for ${colors.yellow}${instructionName}${colors.reset} expected exception with exit code ${expectedExitCode}, but execution succeeded`,
            )
            return false
        }

        const actualStackSize = reader.remaining
        const expectedStackSize = example.stack.output.length

        if (actualStackSize !== expectedStackSize) {
            console.error(
                `${colors.red}✗${colors.reset} Stack size mismatch for ${colors.yellow}${instructionName}${colors.reset} example ${exampleIndex + 1}: ` +
                    `expected ${expectedStackSize} elements, got ${actualStackSize}`,
            )
            return false
        }

        console.log(
            `${colors.green}✓${colors.reset} Example ${exampleIndex + 1} for ${colors.yellow}${instructionName}${colors.reset} validated successfully`,
        )
        return true
    } catch (e) {
        if (e instanceof GetMethodError) {
            const actualExitCode = e.exitCode
            if (expectsException && actualExitCode === expectedExitCode) {
                console.log(
                    `${colors.green}✓${colors.reset} Example ${exampleIndex + 1} for ${colors.yellow}${instructionName}${colors.reset} correctly threw exception with exit code ${actualExitCode}`,
                )
                return true
            }

            if (expectsException) {
                console.error(
                    `${colors.red}✗${colors.reset} Example ${exampleIndex + 1} for ${colors.yellow}${instructionName}${colors.reset} threw exception with exit code ${actualExitCode}, but expected ${expectedExitCode}`,
                )
                return false
            }

            console.error(
                `${colors.red}✗${colors.reset} Example ${exampleIndex + 1} for ${colors.yellow}${instructionName}${colors.reset} unexpectedly threw exception with exit code ${actualExitCode}`,
            )
            return false
        }

        if (expectsException) {
            console.error(
                `${colors.red}✗${colors.reset} Example ${exampleIndex + 1} for ${colors.yellow}${instructionName}${colors.reset} expected exception with exit code ${expectedExitCode}, but got different error:`,
                e,
            )
        } else {
            console.error(
                `${colors.red}✗${colors.reset} Example ${exampleIndex + 1} for ${colors.yellow}${instructionName}${colors.reset} failed:`,
                e,
            )
        }
        return false
    }
}

async function main() {
    const files = fs.readdirSync(`${__dirname}/../data`)

    let totalExamples = 0
    let validatedExamples = 0
    let instructionsWithExamples = 0
    let totalInstructions = 0
    let hasValidationErrors = false

    for (const filename of files) {
        if (filename === "fift") continue

        const descriptions = JSON.parse(
            fs.readFileSync(`${__dirname}/../data/${filename}`, "utf8"),
        ) as Record<string, Instruction>

        for (const [name, instruction] of Object.entries(descriptions)) {
            totalInstructions++

            const examples = instruction.description?.examples
            if (!examples || examples.length === 0) {
                continue
            }

            instructionsWithExamples++
            totalExamples += examples.length

            debugLog(`\nValidating ${examples.length} example(s) for ${name}`)

            let instructionValidatedCount = 0
            for (let i = 0; i < examples.length; i++) {
                try {
                    const isValid = await checkExample(name, examples[i]!, i)
                    if (isValid) {
                        instructionValidatedCount++
                        validatedExamples++
                    } else {
                        hasValidationErrors = true
                    }
                } catch (e) {
                    console.error(`Failed to validate example ${i + 1} for ${name}:`, e)
                    hasValidationErrors = true
                }
            }

            debugLog(
                `Validated ${instructionValidatedCount}/${examples.length} examples for ${name}`,
            )
        }
    }

    console.log("")
    console.log(`Total instructions processed: ${totalInstructions}`)
    console.log(`Instructions with examples: ${instructionsWithExamples}`)
    console.log(`Total examples: ${totalExamples}`)
    console.log(`Successfully validated examples: ${validatedExamples}`)

    if (hasValidationErrors) {
        console.error(`\n${colors.red}Some examples failed validation!${colors.reset}`)
        process.exit(1)
    } else {
        console.log(`\n${colors.green}All examples validated successfully!${colors.reset}`)
    }
}

function debugLog(...args: unknown[]) {
    if (process.env["DEBUG"]) {
        console.log(...args)
    }
}

void main()
