/**
 * This file contains the logic for validating TLB representations from the generated specification.
 * It checks that the TLB strings can be successfully parsed using the `tlb` CLI tool.
 */

import * as fs from "node:fs"
import * as path from "node:path"
import {execSync} from "node:child_process"
import {Specification} from "../src/types"

const colors = {
    green: "\x1b[32m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
    reset: "\x1b[0m",
} as const

async function validateTlb(instructionName: string, tlb: string): Promise<boolean> {
    if (
        instructionName === "PUSHSLICE_LONG" ||
        instructionName === "PUSHSLICE_REFS" ||
        instructionName === "PUSHCONT" ||
        instructionName === "STSLICECONST"
    ) {
        // skip since generator doesn't support all syntax
        // these instructions checked manually with `tlbc`
        return true
    }

    let tempFilePath: string | null = null

    try {
        debugLog(`Validating TLB for ${colors.yellow}${instructionName}${colors.reset}`)

        const fullTlb = `constructor_name${tlb} = Instruction;`

        tempFilePath = path.join(process.cwd(), `temp.tlb`)
        fs.writeFileSync(tempFilePath, fullTlb, "utf8")

        execSync(`./node_modules/@ton-community/tlb-codegen/build/main.js  ${tempFilePath}`, {
            stdio: "pipe",
            cwd: process.cwd(),
        })

        console.log(
            `${colors.green}✓${colors.reset} TLB for ${colors.yellow}${instructionName}${colors.reset} validated successfully`,
        )
        return true
    } catch (error) {
        console.error(
            `${colors.red}✗${colors.reset} TLB validation failed for ${colors.yellow}${instructionName}${colors.reset}:`,
            error instanceof Error ? error.message : error,
        )
        return false
    } finally {
        if (tempFilePath && fs.existsSync(tempFilePath)) {
            try {
                fs.unlinkSync(tempFilePath)
            } catch (cleanupError) {
                console.warn(`Failed to clean up temporary file ${tempFilePath}:`, cleanupError)
            }
        }
        const tsFilePath = tempFilePath?.replace(".tlb", ".ts")
        if (tsFilePath && fs.existsSync(tsFilePath)) {
            try {
                fs.unlinkSync(tsFilePath)
            } catch (cleanupError) {
                console.warn(`Failed to clean up temporary file ${tsFilePath}:`, cleanupError)
            }
        }
    }
}

async function main() {
    const specPath = `${__dirname}/../gen/tvm-specification.json`

    if (!fs.existsSync(specPath)) {
        console.error(`${colors.red}Specification file not found: ${specPath}${colors.reset}`)
        console.error("Please run the generation script first: yarn gen")
        process.exit(1)
    }

    const spec = JSON.parse(fs.readFileSync(specPath, "utf8")) as Specification

    let totalInstructions = 0
    let validatedInstructions = 0
    let hasValidationErrors = false

    for (const instruction of spec.instructions) {
        const name = instruction.name
        totalInstructions++

        const tlb = instruction.layout.tlb
        if (!tlb) {
            console.error(
                `${colors.red}✗${colors.reset} Missing TLB for ${colors.yellow}${name}${colors.reset}`,
            )
            hasValidationErrors = true
            continue
        }

        try {
            const isValid = await validateTlb(name, tlb)
            if (isValid) {
                validatedInstructions++
            } else {
                hasValidationErrors = true
            }
        } catch (error) {
            console.error(`Failed to validate TLB for ${name}:`, error)
            hasValidationErrors = true
        }
    }

    console.log("")
    console.log(`Total instructions processed: ${totalInstructions}`)
    console.log(`Successfully validated TLB: ${validatedInstructions}`)

    if (hasValidationErrors) {
        console.error(`\n${colors.red}Some TLB validations failed!${colors.reset}`)
        process.exit(1)
    } else {
        console.log(`\n${colors.green}All TLB validations passed!${colors.reset}`)
    }
}

function debugLog(...args: unknown[]) {
    if (process.env["DEBUG"]) {
        console.log(...args)
    }
}

void main()
