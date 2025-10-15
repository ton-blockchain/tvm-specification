/**
 * This file contains the logic for validating docs_links.
 * It checks that all documentation links in docs_links are reachable and don't return 404 errors.
 */

import * as fs from "node:fs"
import * as https from "node:https"
import * as http from "node:http"
import {URL} from "node:url"
import {Specification, DocsLink} from "../src/types"

const colors = {
    green: "\x1b[32m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
    reset: "\x1b[0m",
} as const

const urlCache = new Map<string, UrlCheckResult>()

interface UrlCheckResult {
    readonly url: string
    readonly status: "success" | "error" | "timeout"
    readonly statusCode?: number
    readonly error?: string
}

async function checkUrl(url: string, timeoutMs: number = 10000): Promise<UrlCheckResult> {
    return new Promise(resolve => {
        try {
            const parsedUrl = new URL(url)
            const isHttps = parsedUrl.protocol === "https:"

            const client = isHttps ? https : http
            const options = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || (isHttps ? 443 : 80),
                path: parsedUrl.pathname + parsedUrl.search,
                method: "HEAD",
                timeout: timeoutMs,
                headers: {
                    "User-Agent": "TVM-Specification-Validation/1.0",
                },
            }

            const req = client.request(options, res => {
                resolve({
                    url,
                    status: res.statusCode && res.statusCode === 200 ? "success" : "error",
                    statusCode: res.statusCode,
                })
            })

            req.on("error", error => {
                resolve({
                    url,
                    status: "error",
                    error: error.message,
                })
            })

            req.on("timeout", () => {
                req.destroy()
                resolve({
                    url,
                    status: "timeout",
                })
            })

            req.end()
        } catch (error) {
            resolve({
                url,
                status: "error",
                error: error instanceof Error ? error.message : String(error),
            })
        }
    })
}

async function validateDocsLinks(
    instructionName: string,
    docsLinks: readonly DocsLink[],
): Promise<boolean> {
    if (!docsLinks || docsLinks.length === 0) {
        return true
    }

    debugLog(
        `Validating ${docsLinks.length} docs link(s) for ${colors.yellow}${instructionName}${colors.reset}`,
    )

    let allValid = true

    for (const link of docsLinks) {
        let result = urlCache.get(link.url)

        if (!result) {
            result = await checkUrl(link.url)
            urlCache.set(link.url, result)
        } else {
            debugLog(`Using cached result for ${link.url}`)
        }

        if (result.status === "success") {
            console.log(
                `${colors.green}✓${colors.reset} Checking ${colors.yellow}${instructionName}${colors.reset} — "${link.name}": ${link.url}`,
            )
        } else if (result.status === "timeout") {
            console.error(
                `${colors.red}✗${colors.reset} Checking ${colors.yellow}${instructionName}${colors.reset} — "${link.name}": ${link.url} (timeout)`,
            )
            allValid = false
        } else {
            const errorMsg = result.statusCode
                ? `HTTP ${result.statusCode}`
                : (result.error ?? "Unknown error")
            console.error(
                `${colors.red}✗${colors.reset} Checking ${colors.yellow}${instructionName}${colors.reset} — "${link.name}": ${link.url} (${errorMsg})`,
            )
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
    let instructionsWithDocsLinks = 0
    let totalDocsLinks = 0
    let validatedDocsLinks = 0
    let hasValidationErrors = false

    for (const instruction of spec.instructions) {
        const name = instruction.name
        totalInstructions++

        const docsLinks = instruction.description?.docs_links
        if (!docsLinks || docsLinks.length === 0) {
            continue
        }

        instructionsWithDocsLinks++
        totalDocsLinks += docsLinks.length

        debugLog(`\nValidating ${docsLinks.length} docs link(s) for ${name}`)

        const isValid = await validateDocsLinks(name, docsLinks)
        if (isValid) {
            validatedDocsLinks += docsLinks.length
        } else {
            hasValidationErrors = true
        }
    }

    const uniqueUrls = urlCache.size
    const cachedRequests = totalDocsLinks - uniqueUrls

    console.log("")
    console.log(`Total instructions processed: ${totalInstructions}`)
    console.log(`Instructions with docs_links: ${instructionsWithDocsLinks}`)
    console.log(`Total docs_links: ${totalDocsLinks}`)
    console.log(`Unique URLs checked: ${uniqueUrls}`)
    console.log(`Cached requests saved: ${cachedRequests}`)
    console.log(`Successfully validated docs_links: ${validatedDocsLinks}`)

    if (hasValidationErrors) {
        console.error(`\n${colors.red}Some docs_links failed validation!${colors.reset}`)
        process.exit(1)
    } else {
        console.log(`\n${colors.green}All docs_links validated successfully!${colors.reset}`)
        process.exit(0)
    }
}

function debugLog(...args: unknown[]) {
    if (process.env["DEBUG"]) {
        console.log(...args)
    }
}

void main()
