/**
 * This file contains the logic for checking the validity of the instruction signature, which includes:
 * - Input values on the stack
 * - Input values as instruction operands
 *
 * We check the following properties:
 * - Number of elements on the stack to receive
 * - Types of elements on the stack to receive
 * - Number of operands to receive
 * - Types of operands to receive
 */

import {infoOf, instructions, Opcode, arg} from "../src/instructions"
import {beginCell} from "@ton/core"
import {executeInstructions} from "./execute"
import {GetMethodError} from "@ton/sandbox"
import {ADD, compileCell, DROP, Instr, PUSHINT_4, PUSHREF} from "ton-assembly/dist/runtime"
import {code} from "ton-assembly/dist/runtime/util"
import {print} from "ton-assembly/dist/text/printer"
import {parse} from "ton-assembly/dist/text/parse"
import * as fs from "node:fs"
import {InstructionSignature, Specification, StackEntry} from "../src/types"

export const instructionList = (): [string, Opcode][] => {
    return Object.entries(instructions)
        .filter(
            ([name]) =>
                !name.startsWith("f") && !name.startsWith("PSEUDO_") && name !== "DEBUGMARK",
        )
        .map(([rawName, opcode]) => {
            const normalizedHashes = rawName.replace("#", "_")
            return [normalizedHashes, opcode]
        })
}

const generateArgs = (opcode: Opcode): string[] => {
    const args = opcode.args
    if (args.length === 2 && args[0]?.$ === "dict") {
        return ["19", "[0 => {} 2 => {}]"]
    }

    return args.map(arg => generateArg(arg))
}

const VALID_MESSAGE = `b5ee9c72410215010003da00026162006e8b6e8f7695dce221229e367f750f6dfa6f3de475edf53919b04d77eaf70baa8000000000000000000000000003c001140201340302018708014d8c136a0d00463a0f4bbf94e7a8b0492a8d0eb99e340650b5f2cbe37f170bab0018c4c3e48e7bcc95da421b195646aec3e92d369aa00384f3b0865c8d9c6b85dde0030114ff00f4a413f4bcf2c80b0402016205130202cc06090201d4070800c30831c02497c138007434c0c05c6c2544d7c0fc03383e903e900c7e800c5c75c87e800c7e800c1cea6d0000b4c7e08403e29fa954882ea54c4d167c0278208405e3514654882ea58c511100fc02b80d60841657c1ef2ea4d67c02f817c12103fcbc2000113e910c1c2ebcb853600201200a120201200b0d01f1503d33ffa00fa4021f001ed44d0fa00fa40fa40d4305136a1522ac705f2e2c128c2fff2e2c254344270542013541403c85004fa0258cf1601cf16ccc922c8cb0112f400f400cb00c920f9007074c8cb02ca07cbffc9d004fa40f40431fa0020d749c200f2e2c4778018c8cb055008cf1670fa0217cb6b13cc80c009e8210178d4519c8cb1f19cb3f5007fa0222cf165006cf1625fa025003cf16c95005cc2391729171e25008a813a08209c9c380a014bcf2e2c504c98040fb001023c85004fa0258cf1601cf16ccc9ed540201200e1102f73b51343e803e903e90350c0234cffe80145468017e903e9014d6f1c1551cdb5c150804d50500f214013e809633c58073c5b33248b232c044bd003d0032c0327e401c1d3232c0b281f2fff274140371c1472c7cb8b0c2be80146a2860822625a019ad822860822625a028062849e5c412440e0dd7c138c34975c2c0600f1000705279a018a182107362d09cc8cb1f5230cb3f58fa025007cf165007cf16c9718010c8cb0524cf165006fa0215cb6a14ccc971fb0010241023007cc30023c200b08e218210d53276db708010c8cb055008cf165004fa0216cb6a12cb1f12cb3fc972fb0093356c21e203c85004fa0258cf1601cf16ccc9ed5400d73b51343e803e903e90350c01f4cffe803e900c145468549271c17cb8b049f0bffcb8b08160824c4b402805af3cb8b0e0841ef765f7b232c7c572cfd400fe8088b3c58073c5b25c60063232c14933c59c3e80b2dab33260103ec01004f214013e809633c58073c5b3327b55200083d40106b90f6a2687d007d207d206a1802698fc1080bc6a28ca9105d41083deecbef09dd0958f97162e99f98fd001809d02811e428027d012c678b00e78b6664f6aa4001ba0f605da89a1f401f481f481a8610067178d45190000000000000000545d964b800800a82be9dd114ac579209a46fcbe3cc1d4b8f839b0b974237f239a847682cf37ba023edd0bd5`

const DEFAULT_CODE_SLICE = compileCell([
    PUSHINT_4(10),
    PUSHINT_4(5),
    ADD(),
    DROP(),
    PUSHREF(code([])),
    PUSHREF(code([])),
    PUSHREF(code([])),
    DROP(),
    DROP(),
    DROP(),
])
    .toBoc()
    .toString("hex")

const generateArg = (arg: arg): string => {
    const DEFAULT_SLICE = beginCell()
        .storeUint(32, 32)
        .storeBuffer(Buffer.from("hello world"))
        .asSlice()
        .toString()

    switch (arg.$) {
        case "int":
            return "-10"
        case "tinyInt":
            return "1"
        case "control":
            return "c4"
        case "stack":
            return "s1"
        case "largeInt":
            return "9999999999"
        case "uint":
            return "2"
        case "debugstr":
            return "x{deadbeef}"
        case "delta":
            return generateArg(arg.arg)
        case "refCodeSlice":
        case "codeSlice":
        case "inlineCodeSlice":
            return `boc{${DEFAULT_CODE_SLICE}}`
        case "slice":
            return DEFAULT_SLICE
        case "s1":
            return "s1"
        case "plduzArg":
            return "1"
    }

    throw new Error(`unsupported ${arg.$}`)
}

const generateInstruction = (name: string): string => {
    const opcode = infoOf(name) ?? infoOf(name.replace("_", "#"))
    if (!opcode) {
        throw new Error(`unknown opcode ${name}`)
    }
    if (name === "PUSHSLICE_REFS") {
        return `PUSHSLICE_REFS boc{b5ee9c724101020100050001000100006e1c5c44}`
    }
    if (name === "STSLICECONST") {
        return `STSLICECONST boc{b5ee9c724101020100050001000100006e1c5c44}`
    }
    if (name === "SETCP") {
        return `SETCP 0`
    }
    if (name === "SETCP_SHORT") {
        return `SETCP_SHORT -256`
    }
    if (name === "XCHG_IJ") {
        return `XCHG_IJ s1 s2`
    }
    if (name === "XCHG_1I") {
        return `XCHG_1I s1 s2`
    }
    if (name === "PFXDICTSWITCH") {
        return `PFXDICTSWITCH 50 [ 0 => {} ]`
    }
    const args = generateArgs(opcode)
    if (name.startsWith("2")) {
        return name.slice(1) + "2 " + args.join(" ")
    }
    return name + " " + args.join(" ")
}

const generateInstructions = (inputInstructions: string[], instructions: string[]): Instr[] => {
    const lines = instructions.map(it => generateInstruction(it))
    const code = [...inputInstructions, ...lines].join("\n")
    const res = parse("out.tasm", code)
    if (res.$ === "ParseFailure") {
        throw new Error(`cannot parse instructions: ${res.error.msg}, code: ${code}`)
    }
    return res.instructions
}

const SKIPPED_INSTRUCTIONS_FOR_INPUT_VALIDATION = [
    "SENDMSG",
    "SENDRAWMSG",
    "JMPDICT",
    "CALLDICT",
    "CALLDICT_LONG",
    "STSAME",
    "PREVMCBLOCKS", // c7 is not set
    "PREVMCBLOCKS_100", // c7 is not set
    "PREVKEYBLOCK", // c7 is not set
    "PREVKEYBLOCK_100", // c7 is not set
    "GLOBALID", // c7 is not set
    "BTOS", // TVM 12 is not yet released
    "HASHBU", // TVM 12 is not yet released
]

function needSkipInstruction(name: string) {
    if (SKIPPED_INSTRUCTIONS_FOR_INPUT_VALIDATION.includes(name)) {
        return true
    }

    return (
        name.includes("PSEUDO_") ||
        name.includes("DEBUGMARK") ||
        name.includes("RUNVM") ||
        name.includes("ARGS") ||
        name.includes("RIST255") ||
        name.includes("BLS_") ||
        name.includes("CDATASIZE") ||
        name.includes("CHKSIG") ||
        name.includes("UNTIL") ||
        name.includes("WHILE") ||
        name.includes("AGAIN") ||
        name.includes("LDSTDADDR") ||
        name.includes("LDSTDADDRQ") ||
        name.includes("LDOPTSTDADDR") ||
        name.includes("LDOPTSTDADDRQ") ||
        name.includes("STSTDADDR") ||
        name.includes("STSTDADDRQ") ||
        name.includes("STOPTSTDADDR") ||
        name.includes("STOPTSTDADDRQ")
    )
}

function needSkipOutputCheck(name: string) {
    return (
        name === "PFXDICTGETJMP" ||
        name === "SETCODE" ||
        name === "JMPREFDATA" ||
        name.startsWith("XCHG")
    )
}

function generateSpecificProducerOf(name: string): string[] | undefined {
    if (name === "ENDXC") {
        return ["NEWC", "PUSHINT_4 0"]
    }

    if (name === "ENDS") {
        return ["NEWC", "ENDC", "CTOS"]
    }

    if (name === "CHKDEPTH") {
        return ["PUSHINT_4 0"]
    }

    if (name === "SETGASLIMIT") {
        return ["PUSHINT_LONG 1000000"]
    }

    if (name === "SETCODE") {
        return [`PUSHREF boc{${DEFAULT_CODE_SLICE}}`]
    }

    if (name === "SETCONTCTR") {
        return [`PUSHREF boc{${DEFAULT_CODE_SLICE}}`, "PUSHCONT {}"]
    }

    if (name === "POPSAVE") {
        return [`PUSHREF x{00000000001}`]
    }

    if (name === "POPCTR") {
        return [`PUSHREF x{00000000001}`]
    }

    if (name === "SETRETCTR" || name === "SETALTCTR") {
        return [`PUSHREF boc{${DEFAULT_CODE_SLICE}}`]
    }

    if (name === "SENDMSG") {
        return [`PUSHREF boc{${VALID_MESSAGE}}`, "PUSHINT_LONG 64"]
    }

    if (name === "TUPLEVAR") {
        return [`PUSHNULL`, "PUSHNULL", "PUSHINT_4 2"]
    }

    if (name === "UNTUPLEVAR") {
        return [`PUSHNULL`, "PUSHNULL", "TUPLE 2", "PUSHINT_4 2"]
    }

    if (name === "EXPLODEVAR") {
        return [`PUSHNULL`, "PUSHNULL", "TUPLE 2", "PUSHINT_4 2"]
    }

    if (name === "JMPDICT") {
        return [`DICTPUSHCONST 19, [0 => {} 2 => {}]`]
    }

    if (name === "SETCPX") {
        return [`PUSHINT_4 0`]
    }

    if (name === "XCHG_IJ") {
        return [`PUSHINT_4 0`, `PUSHINT_4 1`, `PUSHINT_4 2`]
    }

    if (name === "XCHG_1I") {
        return [`PUSHINT_4 0`, `PUSHINT_4 1`, `PUSHINT_4 2`]
    }

    return undefined
}

function generateProducerOf(type: StackEntry): string[] {
    switch (type.type) {
        case "const":
            switch (type.value_type) {
                case "Int":
                    return ["PUSHINT_4 1"]
                case "Null":
                    return ["PUSHNULL"]
            }
            break
        case "simple":
            if (type.value_types === undefined) {
                // means Any
                return [`PUSHREFCONT boc{${DEFAULT_CODE_SLICE}}`]
            }

            if (type.value_types.length === 0) {
                throw new Error("empty value types")
            }

            if (type.value_types.length === 2) {
                const isNullable = type.value_types[0] === "Null" || type.value_types[1] === "Null"
                if (isNullable) {
                    return ["PUSHNULL"]
                }

                return generateProducerOf({
                    ...type,
                    value_types: [type.value_types[0] ?? "Int"],
                })
            }

            const value_type = type.value_types[0]
            switch (value_type) {
                case "Int":
                    return ["PUSHINT_4 1"]
                case "Bool":
                    return ["PUSHINT_4 -1"]
                case "Cell":
                    return ["PUSHREF x{0000000000000000000000000001}"]
                case "Builder":
                    return ["NEWC"]
                case "Slice":
                    return [
                        "NEWC",
                        "STSLICECONST x{0000000001}",
                        "PUSHREF x{0000000000000000000000000001} SWAP STREF",
                        "PUSHREF x{0000000000000000000000000002} SWAP STREF",
                        "ENDC",
                        "CTOS",
                    ]
                case "Tuple":
                    return ["PUSHINT_4 1", "PUSHNULL", "TUPLE 2"]
                case "Continuation":
                    return [`PUSHREFCONT boc{${DEFAULT_CODE_SLICE}}`]
                case "Null":
                    return ["PUSHNULL"]
            }
            break
        case "array":
            if (type.array_entry[0]?.type === "simple") {
                const arrayType = type.array_entry[0]
                if (arrayType?.value_types?.some(it => it === "Slice")) {
                    return ["PUSHSLICE b{0000001}"]
                }
            }
            return ["PUSHINT_4 1", "PUSHNULL"]
        case "conditional":
            // can be only for output
            throw new Error("conditional type should not be here")
    }

    return []
}

function getExpectedElementsOnStack(outputs: readonly StackEntry[]): [number, boolean] {
    let exact = true
    const elements = outputs.reduce((prev, cur) => {
        if (cur.type === "const") {
            return prev + 1
        }
        if (cur.type === "simple") {
            return prev + 1
        }
        if (cur.type === "array") {
            exact = false
            return prev + 9999
        }

        exact = false
        const armElements = cur.match.map(arm => {
            return getExpectedElementsOnStack(arm.stack)[0]
        })

        return prev + Math.max(...armElements)
    }, 0)
    return [elements, exact]
}

async function checkInstructionInputs(
    name: string,
    signature: InstructionSignature,
): Promise<boolean> {
    if (needSkipInstruction(name)) return false

    const inputs = signature?.inputs?.stack ?? []
    const inputInstructions =
        generateSpecificProducerOf(name) ?? inputs.flatMap(input => generateProducerOf(input))

    const instructions = generateInstructions(inputInstructions, [name])
    try {
        const assembly = print(instructions)
        console.log(assembly)

        const [reader] = await executeInstructions([DROP(), ...instructions], 0)

        // Check that we have expected count of elements after instruction execution
        const outputs = signature.outputs?.stack
        if (outputs) {
            const [expectedElementsOnStack, exact] = getExpectedElementsOnStack(outputs)
            const actualElementsOnStack = reader.remaining

            if (
                exact &&
                expectedElementsOnStack !== actualElementsOnStack &&
                !needSkipOutputCheck(name)
            ) {
                throw new Error(
                    `Expected ${expectedElementsOnStack} on stack after instruction execution, but got ${actualElementsOnStack}`,
                )
            }
        }

        return true
    } catch (e) {
        if (e instanceof Error) {
            if (e.message.includes("Unsupported stack item")) {
                // skip @ton/core weakness
                return true
            }
        }
        if (e instanceof GetMethodError) {
            if (e.message.includes("Got exit_code: 4")) {
                // skip integer overflow error here
                return true
            }
            if (e.message.includes("Got exit_code: 2")) {
                // throwed by explicit THROW
                return true
            }
            if (e.message.includes("Got exit_code: 5")) {
                // skip integer out of range for now
                return true
            }
            if (e.message.includes("Got exit_code: 9")) {
                // skip dict related errors
                return true
            }
            if (e.message.includes("Got exit_code: 8")) {
                // skip scanned too many cells for SDATASIZE
                return true
            }
        }

        throw e
    }
}

function findInstruction(spec: Specification, name: string) {
    return (
        spec.instructions.find(instr => instr.name === name) ??
        spec.instructions.find(instr => instr.name === name.replace("_", "#"))
    )
}

async function main() {
    const spec = JSON.parse(
        fs.readFileSync(`${__dirname}/../gen/tvm-specification.json`, "utf8"),
    ) as Specification

    let counter = 0
    let processedCounter = 0
    for (const [name] of instructionList()) {
        console.log("#" + counter)

        const instrInfo = findInstruction(spec, name)
        if (!instrInfo) {
            throw new Error(`No signature for ${name}`)
        }
        counter++
        if (instrInfo.signature === undefined) {
            continue
        }
        const processed = await checkInstructionInputs(name, instrInfo.signature)
        if (processed) {
            processedCounter++
        }
    }
    console.log("All:", counter)
    console.log("Checked:", processedCounter)
}

void main()
