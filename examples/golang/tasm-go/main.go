package main

import (
	"fmt"
	"os"
	"tasm-go/spec"
	"tasm-go/tasm"

	"github.com/xssnick/tonutils-go/tvm/cell"
)

func main() {
	content, err := os.ReadFile("../../../gen/tvm-specification.json")
	if err != nil {
		return
	}
	tvmSpec, err := spec.UnmarshalSpecification(content)
	if err != nil {
		return
	}

	bocData, err := os.ReadFile("./testdata/jetton_minter_discoverable_JettonMinter.boc")
	if err != nil {
		return
	}

	codeCell, _ := cell.FromBOC(bocData)
	code := tasm.DecompileCell(tvmSpec, codeCell)
	fmt.Println(code)
}
