import {checkProgram, showStack} from "./check"
import {text} from "ton-assembly"
import {Instr} from "ton-assembly/dist/runtime"

// const prog1: Instr[] = [
//     {op: "PUSHINT_4"},
//     {
//         op: "PUSHCONT", body: [
//             {op: "PUSHINT_4"},
//         ],
//     },
//     {op: "IF"},
// ]

// const prog2: Op[] = [
//     {op: "PUSH_i64"},
//     {
//         op: "PUSH_cont", body: [
//             {op: "PUSH_byte"},
//             {op: "PUSH_byte"},
//             {op: "ADDQ"},
//         ],
//     },
//     {op: "IF"},
// ]
//
// const prog3: Op[] = [
//     {op: "PUSH_i32"},
//     {op: "PUSH_f32"},
//     {op: "PUSH_byte"},
//     {op: "PUSH_i64"},
//     {
//         op: "PUSH_cont", body: [
//             {op: "POP"},
//             {op: "PUSH_k", k: 1},
//         ],
//     },
//     {
//         op: "PUSH_cont", body: [
//             {op: "POP"},
//             {op: "PUSH_k", k: 1},
//         ],
//     },
//     {op: "IFELSE"},
// ]
//
// const progUntil: Op[] = [
//     {op: "PUSH_i32"},
//     {
//         op: "PUSH_cont", body: [
//             {op: "DUP"},
//             {op: "ADD"},
//             {op: "PUSH_i64"},
//         ],
//     },
//     {op: "UNTIL"},
// ]

const run = (label: string, p: Instr[]) => {
    try {
        const r = checkProgram(p, { dedupe: true, logContEffects: false });
        console.log(label);
        r.finalStates.forEach((st, i) => {
            console.log(`  [${i}] ${showStack(st.stack, st.subst)} | guards=[${st.guards.join(',')}]`);
        });
    } catch (e) {
        console.error(label, 'ERROR:', e);
    }
};

const program = `
PUSHSLICE x{} // prepare

DUP
PUSHPOW2 9
SDCUTLAST
SWAP
PUSHPOW2 9
SDSKIPLAST
DUP
SDBEGINSQ x{7369676E}
THROWIFNOT 138
LDU 32
LDU 32
LDU 32
LDDICT
LDI 1
PUSHCTR c4
CTOS
LDI 1
LDU 32
DUP
LDU 32
LDU 256
PLDDICT
XCHG_0I s12
HASHSU
XCHG3 s0 s13 s13
CHKSIGNU
THROWIFNOT 135
XCHG_0I s9
ISNULL
XCHG_1I s1 s2
OR
THROWIFNOT 132
XCPU s4 s4
EQUAL
THROWIFNOT 133
XCHG2 s5 s7
EQUAL
THROWIFNOT 134
XCHG_0I s2
NOW
GREATER
THROWIFNOT 136
ACCEPT
INC
NEWC
STSLICECONST x{C_}
STU 32
XCHG_1I s1 s3
STSLICE
ENDC
POPCTR c4
COMMIT
PUSHINT_4 0
PUSH s2
ISNULL
`

const main = () => {
    const res = text.parse("main.tasm", program)
    if (res.$ === "ParseFailure") {
        throw res.error
    }

    // const ops: Instr[] = []
    //
    // for (const instr of res.instructions) {
    //     if (instr.$ === "XCHG_IJ") {
    //         ops.push({
    //             op: "XCHG_IJ",
    //             i: instr.arg0,
    //             j: instr.arg1,
    //         })
    //         continue
    //     }
    //     if (instr.$ === "XCHG_0I") {
    //         ops.push({
    //             op: "XCHG_OI",
    //             i: instr.arg0,
    //         })
    //         continue
    //     }
    //
    //     ops.push({
    //         op: instr.$ as Op,
    //     })
    // }

    run('Prog1', res.instructions);
}

main();
