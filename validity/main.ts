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
        const r = checkProgram(p, {dedupe: true, logContEffects: false})
        console.log(label)
        r.finalStates.forEach((st, i) => {
            console.log(
                `  [${i}] ${showStack(st.stack, st.subst)} | guards=[${st.guards.join(",")}]`,
            )
        })
    } catch (e) {
        console.error(label, "ERROR:", e)
    }
}

const program1 = `
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

PUSHCONT_SHORT {
    POP s2
}
IFELSEREF {
    PUSHINT_4 0
    PUSH s3 
    XCTOS
    DROP
    PUSHCONT {
        DUP
        SBITREFS
        EQINT 2
        THROWIFNOT 147
        EQINT 40
        THROWIFNOT 147
        SDBEGINSQ x{0EC3C86D}
        THROWIFNOT 147
        LDREF
        PLDU 8
        PUSHINT_4 2
        AND
        THROWIFNOT 137
        XCTOS
        DROP
        SWAP
        INC
        OVER
        SEMPTY
        XCHG_1I s1 s2
    }
    UNTIL
    DROP
    PUSHPOW2DEC 8
    LEQ
    THROWIFNOT 147
    XCHG_0I s2
    POPCTR c5
}
PUSHCONT {
    CALLREF {
        SAVECTR c2
        SAMEALTSAVE
        AGAINEND
        OVER
        SDBEGINSQ x{02}
        PUSHCONT {
            LDMSGADDR
            DROP
            REWRITESTDADDR
            MYADDR
            REWRITESTDADDR
            DROP
            ROT
            EQUAL
            THROWIFNOT 145
            PUSHCTR c4
            CTOS
            PUSHINT_16 321
            LDSLICEX
            PLDDICT
            PUSHPOW2 8
            PUSHSLICE x{C_}
            XCHG_0I s3
            XCHG3 s4 s4 s4
            DICTUADD
            THROWIFNOT 139
            SWAP
            NEWC
            STSLICE
            STDICT
            ENDC
            POPCTR c4
        }
        PUSHREFCONT {
            SDBEGINSQ x{03}
            PUSHCONT {
                LDMSGADDR
                DROP
                REWRITESTDADDR
                MYADDR
                REWRITESTDADDR
                DROP
                ROT
                EQUAL
                THROWIFNOT 145
                PUSHCTR c4
                CTOS
                LDI 1
                PUSHINT_16 320
                LDSLICEX
                PLDDICT
                XCHG_1I s1 s3
                PUSHPOW2 8
                DICTUDEL
                THROWIFNOT 140
                OVER
                PUSHCONT_SHORT {
                    DUP
                    ISNULL
                    THROWIF 144
                }
                IFNOT
                SWAP
                NEWC
                STI 1
                XCHG_1I s1 s2
                STSLICE
                STDICT
                ENDC
                POPCTR c4
            }
            PUSHCONT {
                SDBEGINSQ x{04}
                PUSHCONT_SHORT {
                    THROW 141
                }
                IFNOTJMP
                OVER
                THROWIFNOT 146
                PUSHCTR c4
                CTOS
                SWAP
                PLDI 1
                SWAP
                LDI 1
                DUP
                PUSHINT_16 320
                SDSKIPFIRST
                PLDDICT
                XCPU s2 s3
                NEQ
                THROWIFNOT 143
                PUSH s2
                PUSHCONT_SHORT {
                    NIP
                }
                PUSHCONT_SHORT {
                    SWAP
                    ISNULL
                    THROWIF 142
                }
                IFELSE
                SWAP
                NEWC
                STI 1
                STSLICE
                ENDC
                POPCTR c4
            }
            IFELSE
        }
        IFELSE
        OVER
        SREFS
        PUSHCONT_SHORT {
            DROP2
            RETALT
        }
        IFNOTJMP
        SWAP
        PLDREFIDX 0
        CTOS
        SWAP
    }
}
IFJMP
DROP2
`

const program = `
PUSHREF x{}
PUSHSLICE x{}

DUP
SDBEGINSQ x{73696E74}
PUSHCONT {
    OVER
    SBITS
    PUSHINT_16 640
    GEQ
    PUSHCONT_SHORT {
        DROP2
    }
    IFNOTJMP
    OVER
    PUSHPOW2 9
    SDCUTLAST
    XCHG_0I s2
    PUSHPOW2 9
    SDSKIPLAST
    PUSHCTR c4
    CTOS
    LDI 1
    LDU 32
    DUP
    LDU 32
    LDU 256
    PLDDICT
    XCHG_0I s6
    HASHSU
    XCHG3 s0 s8 s8
    CHKSIGNU
    PUSHCONT_SHORT {
        BLKDROP 6
    }
    IFNOTJMP
    XCHG_0I s3
    ISNULL
    XCHG_1I s1 s2
    OR
    THROWIFNOT 132
    XCHG_0I s2
    LDU 32
    LDU 32
    LDU 32
    LDDICT
    LDI 1
    XCPU s3 s7
    EQUAL
    THROWIFNOT 133
    XCHG2 s4 s7
    EQUAL
    THROWIFNOT 134
    SWAP
    NOW
    GREATER
    THROWIFNOT 136
    XCHG_0I s3
    INC
    NEWC
    STSLICECONST x{C_}
    STU 32
    XCHG_1I s1 s2
    STSLICE
    ENDC
    POPCTR c4
    PUSHINT_4 0
    OVER
    ISNULL
    PUSHCONT_SHORT {
        NIP
    }
    IFELSEREF {
        PUSHINT_4 0
        PUSH s2
        XCTOS
        DROP
        PUSHCONT {
            DUP
            SBITREFS
            EQINT 2
            THROWIFNOT 147
            EQINT 40
            THROWIFNOT 147
            SDBEGINSQ x{0EC3C86D}
            THROWIFNOT 147
            PLDREFIDX 0
            XCTOS
            DROP
            SWAP
            INC
            OVER
            SEMPTY
            XCHG_1I s1 s2
        }
        UNTIL
        DROP
        PUSHPOW2DEC 8
        LEQ
        THROWIFNOT 147
        SWAP
        POPCTR c5
    }
    XCHG_0I s2
    PUSHCONT {
        SWAP
        CALLREF {
            SAVECTR c2
            SAMEALTSAVE
            AGAINEND
            OVER
            SDBEGINSQ x{02}
            PUSHCONT {
                LDMSGADDR
                DROP
                REWRITESTDADDR
                MYADDR
                REWRITESTDADDR
                DROP
                ROT
                EQUAL
                THROWIFNOT 145
                PUSHCTR c4
                CTOS
                PUSHINT_16 321
                LDSLICEX
                PLDDICT
                PUSHPOW2 8
                PUSHSLICE x{C_}
                XCHG_0I s3
                XCHG3 s4 s4 s4
                DICTUADD
                THROWIFNOT 139
                SWAP
                NEWC
                STSLICE
                STDICT
                ENDC
                POPCTR c4
            }
            PUSHREFCONT {
                SDBEGINSQ x{03}
                PUSHCONT {
                    LDMSGADDR
                    DROP
                    REWRITESTDADDR
                    MYADDR
                    REWRITESTDADDR
                    DROP
                    ROT
                    EQUAL
                    THROWIFNOT 145
                    PUSHCTR c4
                    CTOS
                    LDI 1
                    PUSHINT_16 320
                    LDSLICEX
                    PLDDICT
                    XCHG_1I s1 s3
                    PUSHPOW2 8
                    DICTUDEL
                    THROWIFNOT 140
                    OVER
                    PUSHCONT_SHORT {
                        DUP
                        ISNULL
                        THROWIF 144
                    }
                    IFNOT
                    SWAP
                    NEWC
                    STI 1
                    XCHG_1I s1 s2
                    STSLICE
                    STDICT
                    ENDC
                    POPCTR c4
                }
                PUSHCONT {
                    SDBEGINSQ x{04}
                    PUSHCONT_SHORT {
                        THROW 141
                    }
                    IFNOTJMP
                    OVER
                    THROWIFNOT 146
                    PUSHCTR c4
                    CTOS
                    SWAP
                    PLDI 1
                    SWAP
                    LDI 1
                    DUP
                    PUSHINT_16 320
                    SDSKIPFIRST
                    PLDDICT
                    XCPU s2 s3
                    NEQ
                    THROWIFNOT 143
                    PUSH s2
                    PUSHCONT_SHORT {
                        NIP
                    }
                    PUSHCONT_SHORT {
                        SWAP
                        ISNULL
                        THROWIF 142
                    }
                    IFELSE
                    SWAP
                    NEWC
                    STI 1
                    STSLICE
                    ENDC
                    POPCTR c4
                }
                IFELSE
            }
            IFELSE
            OVER
            SREFS
            PUSHCONT_SHORT {
                DROP2
                RETALT
            }
            IFNOTJMP
            SWAP
            PLDREFIDX 0
            CTOS
            SWAP
        }
    }
    PUSHCONT_SHORT {
        DROP2
    }
    IFELSE
}
IFJMP
NIP
PUSHREFSLICE {
    DROPX
    PUSHINT_4 8
    PUSHINT_4 4
    ISNULL
}
SDBEGINSXQ
ref {
    PUSHCONT {
        INMSG_SRC
        REWRITESTDADDR
        MYADDR
        REWRITESTDADDR
        DROP
        ROT
        NEQ
        PUSHCONT_SHORT {
            DROP2
        }
        IFJMP
        PUSHCTR c4
        CTOS
        PUSHINT_16 321
        SDSKIPFIRST
        PLDDICT
        PUSHPOW2 8
        DICTUGET
        NULLSWAPIFNOT
        NIP
        PUSHCONT_SHORT {
            DROP
        }
        IFNOTJMP
        LDU 64
        NIP
        LDDICT
        LDI 1
        PUSHINT_4 -1
        PUSH s3
        ISNULL
        PUSHCONT_SHORT {
            POP s3
        }
        PUSHCONT {
            PUSHINT_4 0
            PUSH s4
            XCTOS
            DROP
            PUSHCONT {
                DUP
                SBITREFS
                EQINT 2
                THROWIFNOT 147
                EQINT 40
                THROWIFNOT 147
                SDBEGINSQ x{0EC3C86D}
                THROWIFNOT 147
                PLDREFIDX 0
                XCTOS
                DROP
                SWAP
                INC
                OVER
                SEMPTY
                XCHG_1I s1 s2
            }
            UNTIL
            DROP
            PUSHPOW2DEC 8
            LEQ
            THROWIFNOT 147
            XCHG_0I s3
            POPCTR c5
        }
        IFELSE
        SWAP
        PUSHCONT {
            SWAP
            CALLREF {
                SAVECTR c2
                SAMEALTSAVE
                AGAINEND
                OVER
                SDBEGINSQ x{02}
                PUSHCONT {
                    LDMSGADDR
                    DROP
                    REWRITESTDADDR
                    MYADDR
                    REWRITESTDADDR
                    DROP
                    ROT
                    EQUAL
                    THROWIFNOT 145
                    PUSHCTR c4
                    CTOS
                    PUSHINT_16 321
                    LDSLICEX
                    PLDDICT
                    PUSHPOW2 8
                    PUSHSLICE x{C_}
                    XCHG_0I s3
                    XCHG3 s4 s4 s4
                    DICTUADD
                    THROWIFNOT 139
                    SWAP
                    NEWC
                    STSLICE
                    STDICT
                    ENDC
                    POPCTR c4
                }
                PUSHREFCONT {
                    SDBEGINSQ x{03}
                    PUSHCONT {
                        LDMSGADDR
                        DROP
                        REWRITESTDADDR
                        MYADDR
                        REWRITESTDADDR
                        DROP
                        ROT
                        EQUAL
                        THROWIFNOT 145
                        PUSHCTR c4
                        CTOS
                        LDI 1
                        PUSHINT_16 320
                        LDSLICEX
                        PLDDICT
                        XCHG_1I s1 s3
                        PUSHPOW2 8
                        DICTUDEL
                        THROWIFNOT 140
                        OVER
                        PUSHCONT_SHORT {
                            DUP
                            ISNULL
                            THROWIF 144
                        }
                        IFNOT
                        SWAP
                        NEWC
                        STI 1
                        XCHG_1I s1 s2
                        STSLICE
                        STDICT
                        ENDC
                        POPCTR c4
                    }
                    PUSHCONT {
                        SDBEGINSQ x{04}
                        PUSHCONT_SHORT {
                            THROW 141
                        }
                        IFNOTJMP
                        OVER
                        THROWIFNOT 146
                        PUSHCTR c4
                        CTOS
                        SWAP
                        PLDI 1
                        SWAP
                        LDI 1
                        DUP
                        PUSHINT_16 320
                        SDSKIPFIRST
                        PLDDICT
                        XCPU s2 s3
                        NEQ
                        THROWIFNOT 143
                        PUSH s2
                        PUSHCONT_SHORT {
                            NIP
                        }
                        PUSHCONT_SHORT {
                            SWAP
                            ISNULL
                            THROWIF 142
                        }
                        IFELSE
                        SWAP
                        NEWC
                        STI 1
                        STSLICE
                        ENDC
                        POPCTR c4
                    }
                    IFELSE
                }
                IFELSE
                OVER
                SREFS
                PUSHCONT_SHORT {
                    DROP2
                    RETALT
                }
                IFNOTJMP
                SWAP
                PLDREFIDX 0
                CTOS
                SWAP
            }
        }
        PUSHCONT_SHORT {
            DROP2
        }
        IFELSE
    }
    IFJMP
    DROP
}
`

const main = () => {
    const res = text.parse("main.tasm", program)
    if (res.$ === "ParseFailure") {
        throw res.error
    }

    run("Prog1", res.instructions)
}

main()
