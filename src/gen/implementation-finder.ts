import * as fs from "node:fs"
import * as path from "node:path"
import {execSync} from "node:child_process"
import {instructions} from "../instructions"

interface ImplementationInfo {
    readonly commit_hash: string
    readonly file_path: string
    readonly line_number: number
    readonly function_name: string
}

interface ImplementationMapping {
    [instructionName: string]: ImplementationInfo
}

const TON_REPO_URL = "https://github.com/ton-blockchain/ton.git"
const TMP_DIR = path.join(__dirname, "../../.tmp")
const TON_REPO_PATH = path.join(TMP_DIR, "ton-repo")
const CRYPTO_VM_PATH = path.join(TON_REPO_PATH, "crypto/vm")
const IMPLEMENTATIONS_JSON_PATH = path.join(TMP_DIR, "implementations.json")

function ensureTonRepoCloned(): string {
    if (!fs.existsSync(TMP_DIR)) {
        fs.mkdirSync(TMP_DIR, {recursive: true})
        console.log(`Created .tmp directory: ${TMP_DIR}`)
    }

    if (!fs.existsSync(TON_REPO_PATH)) {
        console.log(`Cloning TON repository to ${TON_REPO_PATH}...`)
        try {
            execSync(`git clone --depth 1 ${TON_REPO_URL} ${TON_REPO_PATH}`, {stdio: "inherit"})
            console.log("TON repository cloned successfully")
        } catch (error) {
            console.error("Failed to clone TON repository:", error)
            process.exit(1)
        }
    } else {
        console.log("TON repository already exists")
    }

    try {
        const commitHash = execSync("git rev-parse HEAD", {
            cwd: TON_REPO_PATH,
            encoding: "utf-8",
        }).trim()
        console.log(`Current commit: ${commitHash}`)
        return commitHash
    } catch (error) {
        console.error("Failed to get commit hash:", error)
        process.exit(1)
    }
}

/**
 * Extract function name from exec string
 * Patterns to match:
 * - exec_functionname
 * - => exec_functionname(
 * - (_1) => exec_functionname(_1, false)
 */
function extractFunctionName(execString: string): string | undefined {
    const cleanExec = execString.replace(/[`'"]/g, "").trim()

    // Pattern 1: Direct call like "exec_push_nan"
    const directMatch = cleanExec.match(/^exec_([a-zA-Z_0-9]+)$/)
    if (directMatch) {
        return cleanExec
    }

    // Pattern 2: Arrow function like "(_1) => exec_add(_1, false)" or "=> exec_add(_1, false)"
    const arrowMatch = cleanExec.match(/=>\s*(exec_[a-zA-Z_0-9]+)\s*\(/)
    if (arrowMatch && arrowMatch[1]) {
        return arrowMatch[1]
    }

    // Pattern 3: Function call in more complex expressions
    const funcCallMatch = cleanExec.match(/(exec_[a-zA-Z_0-9]+)\s*\(/)
    if (funcCallMatch && funcCallMatch[1]) {
        return funcCallMatch[1]
    }

    return undefined
}

function findCppFiles(dir: string): string[] {
    const cppFiles: string[] = []

    if (!fs.existsSync(dir)) {
        console.error(`Directory not found: ${dir}`)
        return cppFiles
    }

    const entries = fs.readdirSync(dir, {withFileTypes: true})

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)

        if (entry.isDirectory()) {
            cppFiles.push(...findCppFiles(fullPath))
        } else if (entry.isFile() && entry.name.endsWith(".cpp")) {
            cppFiles.push(fullPath)
        }
    }

    return cppFiles
}

/**
 * Search for function definition in C++ files
 * Looks for patterns like:
 * - `int exec_functionname(`
 * - `void exec_functionname(`
 * - `bool exec_functionname(`
 * - `static int exec_functionname(`
 */
function findFunctionDefinition(
    functionName: string,
    cppFiles: string[],
    commitHash: string,
): ImplementationInfo | undefined {
    const functionPattern = new RegExp(
        `^\\s*(?:static\\s+)?(?:int|void|bool|VmState)\\s+${functionName}\\s*\\(`,
        "gm",
    )

    for (const filePath of cppFiles) {
        try {
            const content = fs.readFileSync(filePath, "utf-8")
            const lines = content.split("\n")

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i]
                if (line && functionPattern.test(line)) {
                    const relativePath = path.relative(TON_REPO_PATH, filePath)
                    return {
                        commit_hash: commitHash,
                        file_path: relativePath,
                        line_number: i + 1,
                        function_name: functionName,
                    }
                }
            }
        } catch (error) {
            console.warn(`Error reading file ${filePath}:`, error)
        }
    }

    return undefined
}

function generateImplementationMapping(commitHash: string): ImplementationMapping {
    console.log(`TON repository path: ${TON_REPO_PATH}`)
    console.log(`Crypto/VM path: ${CRYPTO_VM_PATH}`)
    console.log(`Commit hash: ${commitHash}`)

    const cppFiles = findCppFiles(CRYPTO_VM_PATH)
    console.log(`Found ${cppFiles.length} C++ files in ${CRYPTO_VM_PATH}`)

    const implementationMapping: ImplementationMapping = {}
    let foundCount = 0
    let totalCount = 0

    for (const [instructionName, opcode] of Object.entries(instructions)) {
        if (instructionName.startsWith("f") || instructionName.startsWith("PSEUDO")) {
            // don't process pseudo and Fift instructions
            continue
        }

        totalCount++

        const functionName = extractFunctionName(opcode.exec)
        if (!functionName) {
            console.error(
                `Could not extract function name from instruction ${instructionName}: ${opcode.exec}`,
            )
            continue
        }

        const implementation = findFunctionDefinition(functionName, cppFiles, commitHash)
        if (implementation) {
            implementationMapping[instructionName] = implementation
            foundCount++
        } else {
            console.error(`✗ Implementation not found for ${instructionName} -> ${functionName}`)
        }
    }

    console.log(
        `\nSummary: Found ${foundCount}/${totalCount} implementations (${Math.round((foundCount / totalCount) * 100)}%)`,
    )

    return implementationMapping
}

function saveImplementationMapping(mapping: ImplementationMapping, outputPath: string): void {
    const outputDir = path.dirname(outputPath)
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, {recursive: true})
    }

    fs.writeFileSync(outputPath, JSON.stringify(mapping, undefined, 2), "utf-8")
    console.log(`Implementation mapping saved to ${outputPath}`)
}

function main(): void {
    const commitHash = ensureTonRepoCloned()
    const implementationMapping = generateImplementationMapping(commitHash)
    saveImplementationMapping(implementationMapping, IMPLEMENTATIONS_JSON_PATH)

    console.log("Implementation finder completed successfully")
}

if (require.main === module) {
    main()
}
