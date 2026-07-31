/**
 * Browser-Based Bytecode Compiler & Virtual Machine Register Emulator
 * Core VM Engine, Assembler, and UI Manager
 */

(function () {
    'use strict';

    // =========================================================================
    // VM HARDWARE STATE & CONSTANTS
    // =========================================================================
    const MEMORY_SIZE = 256;
    
    // Register Map IDs
    const REG_MAP = {
        'ACC': 0, 'A': 0,
        'R0': 1,
        'R1': 2,
        'R2': 3,
        'R3': 4
    };
    const REG_NAMES = ['ACC', 'R0', 'R1', 'R2', 'R3'];

    class VirtualMachine {
        constructor() {
            this.memory = new Uint8Array(MEMORY_SIZE);
            this.registers = {
                PC: 0x00,  // Program Counter (0..255)
                SP: 0xFF,  // Stack Pointer (starts at 0xFF down)
                ACC: 0,    // Accumulator
                R0: 0,
                R1: 0,
                R2: 0,
                R3: 0
            };
            this.flags = {
                Z: 0, // Zero flag
                C: 0, // Carry flag
                N: 0  // Negative flag (bit 7 set)
            };
            this.status = 'IDLE'; // IDLE, RUNNING, PAUSED, HALTED, ERROR
            this.cycleCount = 0;
            
            // Debug & Source Mapping
            this.sourceMap = new Array(MEMORY_SIZE).fill(null); // PC addr -> Line number
            this.disassemblyMap = new Array(MEMORY_SIZE).fill(null); // PC addr -> Instruction Metadata
            this.programSize = 0;
            this.callStack = []; // Helper list for live stack UI inspector
        }

        reset() {
            this.memory.fill(0);
            this.registers.PC = 0x00;
            this.registers.SP = 0xFF;
            this.registers.ACC = 0;
            this.registers.R0 = 0;
            this.registers.R1 = 0;
            this.registers.R2 = 0;
            this.registers.R3 = 0;
            
            this.flags.Z = 0;
            this.flags.C = 0;
            this.flags.N = 0;
            
            this.status = 'IDLE';
            this.cycleCount = 0;
            this.callStack = [];
        }

        setFlagZ(val) { this.flags.Z = (val & 0xFF) === 0 ? 1 : 0; }
        setFlagC(val) { this.flags.C = val > 255 || val < 0 ? 1 : 0; }
        setFlagN(val) { this.flags.N = (val & 0x80) !== 0 ? 1 : 0; }

        updateFlags(result) {
            this.setFlagZ(result);
            this.setFlagC(result);
            this.setFlagN(result);
        }

        getRegisterValue(regId) {
            switch (regId) {
                case 0: return this.registers.ACC;
                case 1: return this.registers.R0;
                case 2: return this.registers.R1;
                case 3: return this.registers.R2;
                case 4: return this.registers.R3;
                default: return 0;
            }
        }

        setRegisterValue(regId, val) {
            const maskedVal = val & 0xFF;
            switch (regId) {
                case 0: this.registers.ACC = maskedVal; break;
                case 1: this.registers.R0 = maskedVal; break;
                case 2: this.registers.R1 = maskedVal; break;
                case 3: this.registers.R2 = maskedVal; break;
                case 4: this.registers.R3 = maskedVal; break;
            }
            return maskedVal;
        }

        pushStack(val) {
            if (this.registers.SP < 0xD0) { // Limit stack to 0xD0..0xFF
                throw new Error("Stack Overflow! Stack Pointer reached RAM space.");
            }
            this.memory[this.registers.SP] = val & 0xFF;
            this.callStack.push({ addr: this.registers.SP, val: val & 0xFF });
            this.registers.SP = (this.registers.SP - 1) & 0xFF;
        }

        popStack() {
            if (this.registers.SP >= 0xFF) {
                throw new Error("Stack Underflow! Stack Pointer at 0xFF.");
            }
            this.registers.SP = (this.registers.SP + 1) & 0xFF;
            const val = this.memory[this.registers.SP];
            this.callStack.pop();
            return val;
        }

        // Single Instruction Step Execution
        step() {
            if (this.status === 'HALTED' || this.status === 'ERROR') {
                return false;
            }

            const pc = this.registers.PC;
            if (pc >= MEMORY_SIZE) {
                this.status = 'HALTED';
                throw new Error("PC out of memory bounds (>= 256). CPU Halted.");
            }

            const opcode = this.memory[pc];
            this.cycleCount++;

            // Decode & Execute
            let nextPC = pc + 1;

            switch (opcode) {
                case 0x00: // HALT / NOP
                    this.status = 'HALTED';
                    return false;

                // --- LOAD Instructions ---
                case 0x10: case 0x11: case 0x12: case 0x13: case 0x14: { // LOAD reg, imm
                    const regId = opcode - 0x10;
                    const imm = this.memory[pc + 1];
                    this.setRegisterValue(regId, imm);
                    nextPC = pc + 2;
                    break;
                }
                case 0x15: case 0x16: case 0x17: case 0x18: case 0x19: { // LOAD reg, [addr]
                    const regId = opcode - 0x15;
                    const addr = this.memory[pc + 1];
                    const val = this.memory[addr];
                    this.setRegisterValue(regId, val);
                    nextPC = pc + 2;
                    break;
                }

                // --- STORE Instructions ---
                case 0x20: case 0x21: case 0x22: case 0x23: case 0x24: { // STORE reg, [addr]
                    const regId = opcode - 0x20;
                    const addr = this.memory[pc + 1];
                    const val = this.getRegisterValue(regId);
                    this.memory[addr] = val;
                    nextPC = pc + 2;
                    break;
                }

                // --- MOV Instructions ---
                case 0x2A: { // MOV reg1, reg2
                    const r1 = this.memory[pc + 1];
                    const r2 = this.memory[pc + 2];
                    const val = this.getRegisterValue(r2);
                    this.setRegisterValue(r1, val);
                    nextPC = pc + 3;
                    break;
                }
                case 0x2B: { // MOV reg1, imm
                    const r1 = this.memory[pc + 1];
                    const imm = this.memory[pc + 2];
                    this.setRegisterValue(r1, imm);
                    nextPC = pc + 3;
                    break;
                }

                // --- ADD Instructions ---
                case 0x30: { // ADD ACC, reg
                    const r = this.memory[pc + 1];
                    const val = this.getRegisterValue(r);
                    const raw = this.registers.ACC + val;
                    this.registers.ACC = raw & 0xFF;
                    this.updateFlags(raw);
                    nextPC = pc + 2;
                    break;
                }
                case 0x31: { // ADD ACC, imm
                    const imm = this.memory[pc + 1];
                    const raw = this.registers.ACC + imm;
                    this.registers.ACC = raw & 0xFF;
                    this.updateFlags(raw);
                    nextPC = pc + 2;
                    break;
                }
                case 0x32: { // ADD reg1, reg2
                    const r1 = this.memory[pc + 1];
                    const r2 = this.memory[pc + 2];
                    const v1 = this.getRegisterValue(r1);
                    const v2 = this.getRegisterValue(r2);
                    const raw = v1 + v2;
                    this.setRegisterValue(r1, raw & 0xFF);
                    this.updateFlags(raw);
                    nextPC = pc + 3;
                    break;
                }

                // --- SUB Instructions ---
                case 0x40: { // SUB ACC, reg
                    const r = this.memory[pc + 1];
                    const val = this.getRegisterValue(r);
                    const raw = this.registers.ACC - val;
                    this.registers.ACC = raw & 0xFF;
                    this.updateFlags(raw < 0 ? (raw + 256) : raw);
                    if (raw < 0) this.flags.C = 1;
                    nextPC = pc + 2;
                    break;
                }
                case 0x41: { // SUB ACC, imm
                    const imm = this.memory[pc + 1];
                    const raw = this.registers.ACC - imm;
                    this.registers.ACC = raw & 0xFF;
                    this.updateFlags(raw < 0 ? (raw + 256) : raw);
                    if (raw < 0) this.flags.C = 1;
                    nextPC = pc + 2;
                    break;
                }
                case 0x42: { // SUB reg1, reg2
                    const r1 = this.memory[pc + 1];
                    const r2 = this.memory[pc + 2];
                    const v1 = this.getRegisterValue(r1);
                    const v2 = this.getRegisterValue(r2);
                    const raw = v1 - v2;
                    this.setRegisterValue(r1, raw & 0xFF);
                    this.updateFlags(raw < 0 ? (raw + 256) : raw);
                    if (raw < 0) this.flags.C = 1;
                    nextPC = pc + 3;
                    break;
                }

                // --- INC / DEC ---
                case 0x45: { // INC reg
                    const r = this.memory[pc + 1];
                    const val = (this.getRegisterValue(r) + 1) & 0xFF;
                    this.setRegisterValue(r, val);
                    this.setFlagZ(val);
                    nextPC = pc + 2;
                    break;
                }
                case 0x46: { // DEC reg
                    const r = this.memory[pc + 1];
                    const val = (this.getRegisterValue(r) - 1) & 0xFF;
                    this.setRegisterValue(r, val);
                    this.setFlagZ(val);
                    nextPC = pc + 2;
                    break;
                }

                // --- CMP ---
                case 0x48: { // CMP reg1, reg2
                    const r1 = this.memory[pc + 1];
                    const r2 = this.memory[pc + 2];
                    const v1 = this.getRegisterValue(r1);
                    const v2 = this.getRegisterValue(r2);
                    const raw = v1 - v2;
                    this.setFlagZ(raw & 0xFF);
                    this.flags.C = (raw < 0) ? 1 : 0;
                    nextPC = pc + 3;
                    break;
                }
                case 0x49: { // CMP reg, imm
                    const r1 = this.memory[pc + 1];
                    const imm = this.memory[pc + 2];
                    const v1 = this.getRegisterValue(r1);
                    const raw = v1 - imm;
                    this.setFlagZ(raw & 0xFF);
                    this.flags.C = (raw < 0) ? 1 : 0;
                    nextPC = pc + 3;
                    break;
                }

                // --- JUMP Instructions ---
                case 0x50: { // JMP target
                    const target = this.memory[pc + 1];
                    nextPC = target;
                    break;
                }
                case 0x51: { // JZ target
                    const target = this.memory[pc + 1];
                    if (this.flags.Z === 1) {
                        nextPC = target;
                    } else {
                        nextPC = pc + 2;
                    }
                    break;
                }
                case 0x52: { // JNZ target
                    const target = this.memory[pc + 1];
                    if (this.flags.Z === 0) {
                        nextPC = target;
                    } else {
                        nextPC = pc + 2;
                    }
                    break;
                }

                // --- STACK Instructions ---
                case 0x60: { // PUSH reg
                    const r = this.memory[pc + 1];
                    this.pushStack(this.getRegisterValue(r));
                    nextPC = pc + 2;
                    break;
                }
                case 0x61: { // PUSH imm
                    const imm = this.memory[pc + 1];
                    this.pushStack(imm);
                    nextPC = pc + 2;
                    break;
                }
                case 0x62: { // POP reg
                    const r = this.memory[pc + 1];
                    const val = this.popStack();
                    this.setRegisterValue(r, val);
                    nextPC = pc + 2;
                    break;
                }

                // --- SUBROUTINE CALL & RET ---
                case 0x70: { // CALL target
                    const target = this.memory[pc + 1];
                    const returnAddr = pc + 2;
                    this.pushStack(returnAddr);
                    nextPC = target;
                    break;
                }
                case 0x71: { // RET
                    const returnAddr = this.popStack();
                    nextPC = returnAddr;
                    break;
                }

                default:
                    this.status = 'ERROR';
                    throw new Error(`Unknown Opcode 0x${opcode.toString(16).toUpperCase().padStart(2, '0')} at address 0x${pc.toString(16).padStart(2, '0')}`);
            }

            this.registers.PC = nextPC;
            return true;
        }
    }

    // =========================================================================
    // ASSEMBLER COMPILER (2-PASS COMPILER)
    // =========================================================================
    class Assembler {
        static parseValue(token, symbolTable = {}) {
            if (!token) return 0;
            token = token.trim();
            
            // Address in brackets like [0x80] or [128]
            if (token.startsWith('[') && token.endsWith(']')) {
                token = token.substring(1, token.length - 1).trim();
            }

            // Label lookup
            if (symbolTable.hasOwnProperty(token)) {
                return symbolTable[token];
            }

            // Hex number (0x1A or 1Ah)
            if (token.startsWith('0x') || token.startsWith('0X')) {
                return parseInt(token.substring(2), 16);
            }
            if (token.endsWith('h') || token.endsWith('H')) {
                return parseInt(token.substring(0, token.length - 1), 16);
            }

            // Decimal integer
            const parsed = parseInt(token, 10);
            return isNaN(parsed) ? 0 : parsed;
        }

        static parseRegister(token) {
            if (!token) return null;
            const clean = token.replace(/,/g, '').trim().toUpperCase();
            if (REG_MAP.hasOwnProperty(clean)) {
                return REG_MAP[clean];
            }
            return null;
        }

        static assemble(sourceCode) {
            const lines = sourceCode.split('\n');
            const symbolTable = {};
            const parsedInstructions = [];
            const logs = [];
            
            let currentByteOffset = 0;
            logs.push({ type: 'info', text: '--- Pass 1: Label Resolution & Syntax Validation ---' });

            // Pass 1: Symbol Table & Address Calculation
            for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
                let rawLine = lines[lineIdx];
                const lineNum = lineIdx + 1;

                // Strip comments
                const commentIdx = rawLine.indexOf(';');
                if (commentIdx !== -1) {
                    rawLine = rawLine.substring(0, commentIdx);
                }
                rawLine = rawLine.trim();
                if (!rawLine) continue;

                // Check for label definition
                if (rawLine.endsWith(':') || rawLine.includes(':')) {
                    const parts = rawLine.split(':');
                    const labelName = parts[0].trim();
                    if (labelName) {
                        symbolTable[labelName] = currentByteOffset;
                        logs.push({ type: 'info', text: `Found Label '${labelName}' -> Address 0x${currentByteOffset.toString(16).padStart(2, '0').toUpperCase()}` });
                    }
                    rawLine = parts[1] ? parts[1].trim() : '';
                    if (!rawLine) continue;
                }

                // Tokens
                const tokens = rawLine.split(/[\s,]+/).filter(t => t.length > 0);
                const mnemonic = tokens[0].toUpperCase();

                let instrSize = 1;
                switch (mnemonic) {
                    case 'HALT': case 'NOP': case 'RET':
                        instrSize = 1; break;
                    case 'LOAD': case 'STORE': case 'ADD': case 'SUB': case 'INC': case 'DEC':
                    case 'JMP': case 'JZ': case 'JNZ': case 'PUSH': case 'POP': case 'CALL':
                        instrSize = 2; break;
                    case 'MOV': case 'CMP':
                        // MOV reg, reg or MOV reg, imm -> 3 bytes
                        instrSize = 3; break;
                    default:
                        logs.push({ type: 'warning', text: `Line ${lineNum}: Unrecognized token '${mnemonic}', defaulting size 2.` });
                        instrSize = 2;
                }

                parsedInstructions.push({
                    lineNum,
                    rawLine,
                    mnemonic,
                    tokens,
                    offset: currentByteOffset,
                    size: instrSize
                });

                currentByteOffset += instrSize;
                if (currentByteOffset > MEMORY_SIZE) {
                    throw new Error(`Line ${lineNum}: Assembly code exceeds 256-byte VM memory limit!`);
                }
            }

            logs.push({ type: 'info', text: `--- Pass 2: Hex Bytecode Generation (${currentByteOffset} Bytes) ---` });

            // Pass 2: Bytecode Generation
            const bytecode = new Uint8Array(MEMORY_SIZE);
            const sourceMap = new Array(MEMORY_SIZE).fill(null);
            const disassemblyMap = new Array(MEMORY_SIZE).fill(null);

            for (const instr of parsedInstructions) {
                const { lineNum, mnemonic, tokens, offset, rawLine } = instr;
                let opBytes = [];

                switch (mnemonic) {
                    case 'HALT': case 'NOP':
                        opBytes = [0x00]; break;
                    
                    case 'LOAD': {
                        // LOAD dest, src
                        const reg = Assembler.parseRegister(tokens[1]);
                        const isMemoryAccess = tokens[2] && tokens[2].includes('[');
                        const val = Assembler.parseValue(tokens[2], symbolTable);

                        if (reg !== null) {
                            if (isMemoryAccess) {
                                opBytes = [0x15 + reg, val & 0xFF];
                            } else {
                                opBytes = [0x10 + reg, val & 0xFF];
                            }
                        } else {
                            throw new Error(`Line ${lineNum}: Invalid register in LOAD statement.`);
                        }
                        break;
                    }

                    case 'STORE': {
                        // STORE src, [addr]
                        const reg = Assembler.parseRegister(tokens[1]);
                        const addr = Assembler.parseValue(tokens[2], symbolTable);
                        if (reg !== null) {
                            opBytes = [0x20 + reg, addr & 0xFF];
                        } else {
                            throw new Error(`Line ${lineNum}: Invalid register in STORE statement.`);
                        }
                        break;
                    }

                    case 'MOV': {
                        // MOV dest, src
                        const destReg = Assembler.parseRegister(tokens[1]);
                        const srcReg = Assembler.parseRegister(tokens[2]);
                        if (destReg !== null) {
                            if (srcReg !== null) {
                                opBytes = [0x2A, destReg, srcReg];
                            } else {
                                const val = Assembler.parseValue(tokens[2], symbolTable);
                                opBytes = [0x2B, destReg, val & 0xFF];
                            }
                        } else {
                            throw new Error(`Line ${lineNum}: Invalid destination register in MOV.`);
                        }
                        break;
                    }

                    case 'ADD': {
                        // ADD ACC, reg/imm OR ADD reg1, reg2
                        const r1 = Assembler.parseRegister(tokens[1]);
                        const r2 = Assembler.parseRegister(tokens[2]);
                        if (r1 === 0) { // ACC
                            if (r2 !== null) {
                                opBytes = [0x30, r2];
                            } else {
                                const val = Assembler.parseValue(tokens[2], symbolTable);
                                opBytes = [0x31, val & 0xFF];
                            }
                        } else if (r1 !== null && r2 !== null) {
                            opBytes = [0x32, r1, r2];
                        } else { // Single operand ADD reg/val implies ADD ACC, reg/val
                            const singleReg = Assembler.parseRegister(tokens[1]);
                            if (singleReg !== null) {
                                opBytes = [0x30, singleReg];
                            } else {
                                const val = Assembler.parseValue(tokens[1], symbolTable);
                                opBytes = [0x31, val & 0xFF];
                            }
                        }
                        break;
                    }

                    case 'SUB': {
                        // SUB ACC, reg/imm OR SUB reg1, reg2
                        const r1 = Assembler.parseRegister(tokens[1]);
                        const r2 = Assembler.parseRegister(tokens[2]);
                        if (r1 === 0) { // ACC
                            if (r2 !== null) {
                                opBytes = [0x40, r2];
                            } else {
                                const val = Assembler.parseValue(tokens[2], symbolTable);
                                opBytes = [0x41, val & 0xFF];
                            }
                        } else if (r1 !== null && r2 !== null) {
                            opBytes = [0x42, r1, r2];
                        } else {
                            const singleReg = Assembler.parseRegister(tokens[1]);
                            if (singleReg !== null) {
                                opBytes = [0x40, singleReg];
                            } else {
                                const val = Assembler.parseValue(tokens[1], symbolTable);
                                opBytes = [0x41, val & 0xFF];
                            }
                        }
                        break;
                    }

                    case 'INC': {
                        const reg = Assembler.parseRegister(tokens[1]);
                        opBytes = [0x45, reg !== null ? reg : 0];
                        break;
                    }
                    case 'DEC': {
                        const reg = Assembler.parseRegister(tokens[1]);
                        opBytes = [0x46, reg !== null ? reg : 0];
                        break;
                    }

                    case 'CMP': {
                        const r1 = Assembler.parseRegister(tokens[1]);
                        const r2 = Assembler.parseRegister(tokens[2]);
                        if (r1 !== null) {
                            if (r2 !== null) {
                                opBytes = [0x48, r1, r2];
                            } else {
                                const val = Assembler.parseValue(tokens[2], symbolTable);
                                opBytes = [0x49, r1, val & 0xFF];
                            }
                        } else {
                            throw new Error(`Line ${lineNum}: Invalid register in CMP.`);
                        }
                        break;
                    }

                    case 'JMP': {
                        const target = Assembler.parseValue(tokens[1], symbolTable);
                        opBytes = [0x50, target & 0xFF];
                        break;
                    }
                    case 'JZ': {
                        const target = Assembler.parseValue(tokens[1], symbolTable);
                        opBytes = [0x51, target & 0xFF];
                        break;
                    }
                    case 'JNZ': {
                        const target = Assembler.parseValue(tokens[1], symbolTable);
                        opBytes = [0x52, target & 0xFF];
                        break;
                    }

                    case 'PUSH': {
                        const reg = Assembler.parseRegister(tokens[1]);
                        if (reg !== null) {
                            opBytes = [0x60, reg];
                        } else {
                            const val = Assembler.parseValue(tokens[1], symbolTable);
                            opBytes = [0x61, val & 0xFF];
                        }
                        break;
                    }

                    case 'POP': {
                        const reg = Assembler.parseRegister(tokens[1]);
                        opBytes = [0x62, reg !== null ? reg : 0];
                        break;
                    }

                    case 'CALL': {
                        const target = Assembler.parseValue(tokens[1], symbolTable);
                        opBytes = [0x70, target & 0xFF];
                        break;
                    }
                    case 'RET': {
                        opBytes = [0x71];
                        break;
                    }

                    default:
                        throw new Error(`Line ${lineNum}: Unsupported mnemonic '${mnemonic}'`);
                }

                // Write to bytecode array & metadata map
                for (let b = 0; b < opBytes.length; b++) {
                    const addr = offset + b;
                    bytecode[addr] = opBytes[b];
                    sourceMap[addr] = lineNum;
                }

                disassemblyMap[offset] = {
                    lineNum,
                    rawText: rawLine,
                    mnemonic,
                    bytes: opBytes,
                    hexString: opBytes.map(x => x.toString(16).padStart(2, '0').toUpperCase()).join(' ')
                };
            }

            logs.push({ type: 'success', text: `[SUCCESS] Compilation complete. Bytecode generated successfully (${currentByteOffset} Bytes).` });

            return {
                bytecode,
                size: currentByteOffset,
                sourceMap,
                disassemblyMap,
                symbolTable,
                logs
            };
        }
    }

    // =========================================================================
    // PRESET SAMPLE PROGRAMS
    // =========================================================================
    const SAMPLE_PROGRAMS = {
        fibonacci: `; Fibonacci Sequence Generator
; Calculates 7th Fibonacci number (13 / 0x0D)
; Saves sequence into RAM [0x80]..[0x86]

    LOAD R0, 0        ; F(0) = 0
    LOAD R1, 1        ; F(1) = 1
    LOAD R2, 7        ; Counter N = 7
    LOAD R3, 128      ; RAM Pointer = 0x80 (128)

LOOP:
    MOV ACC, R2
    JZ DONE           ; Loop until counter is zero
    
    STORE R1, [0x80]  ; Store current fib number
    
    MOV ACC, R0       ; ACC = R0
    ADD ACC, R1       ; ACC = R0 + R1
    MOV R0, R1        ; R0 = R1
    MOV R1, ACC       ; R1 = new Fibonacci value
    
    DEC R2            ; Counter--
    JMP LOOP

DONE:
    LOAD ACC, [0x80]  ; Load result into ACC
    HALT
`,
        factorial: `; Factorial Calculator (5! = 120 / 0x78)
; R0 = N (5), R1 = Accumulator product result (1)

    LOAD R0, 5        ; Compute 5!
    LOAD R1, 1        ; Result starts at 1

FACT_LOOP:
    MOV ACC, R0
    JZ FACT_DONE      ; When R0 == 0, finished
    
    ; Multiply R1 by R0 via repeated addition
    MOV R2, R0        ; Multiplier loop counter = R0
    LOAD R3, 0        ; Product temp = 0

MULT_LOOP:
    MOV ACC, R2
    JZ MULT_DONE
    MOV ACC, R3
    ADD ACC, R1       ; R3 += R1
    MOV R3, ACC
    DEC R2
    JMP MULT_LOOP

MULT_DONE:
    MOV R1, R3        ; R1 = new product
    DEC R0            ; R0--
    JMP FACT_LOOP

FACT_DONE:
    MOV ACC, R1       ; Put final answer 120 in ACC
    STORE ACC, [0x85] ; Store in RAM address 0x85
    HALT
`,
        array_sum: `; Array Summation Demo
; Pre-stores values in RAM [0x80]..[0x83] & sums them

    ; 1. Initialize RAM array elements
    LOAD ACC, 12
    STORE ACC, [0x80]
    LOAD ACC, 24
    STORE ACC, [0x81]
    LOAD ACC, 36
    STORE ACC, [0x82]
    LOAD ACC, 48
    STORE ACC, [0x83]

    ; 2. Calculate Sum of array
    LOAD R0, 4        ; Count = 4 elements
    LOAD ACC, 0       ; Total Sum accumulator = 0

    LOAD R1, [0x80]   ; Element 1
    ADD ACC, R1
    
    LOAD R1, [0x81]   ; Element 2
    ADD ACC, R1
    
    LOAD R1, [0x82]   ; Element 3
    ADD ACC, R1
    
    LOAD R1, [0x83]   ; Element 4
    ADD ACC, R1

    STORE ACC, [0x90] ; Store Total Sum (120) at RAM 0x90
    HALT
`,
        stack_demo: `; Stack & Subroutine Demo (CALL / RET / PUSH / POP)
; Demonstrates stack push/pop and subroutine calls

    LOAD R0, 42       ; Load test value 42
    LOAD R1, 99       ; Load test value 99

    PUSH R0           ; Push 42 to stack
    PUSH R1           ; Push 99 to stack

    CALL DOUBLE_VAL   ; Call subroutine at DOUBLE_VAL

    POP R3            ; Pop top of stack into R3 (99)
    POP R2            ; Pop next value into R2 (42)
    HALT

DOUBLE_VAL:
    LOAD ACC, 15
    ADD ACC, 15       ; ACC = 30
    RET               ; Return to caller address
`,
        counter_loop: `; Counter & Memory Writing Loop
; Counts from 1 to 10 and stores values into RAM

    LOAD R0, 1        ; Start counter at 1
    LOAD R1, 10       ; Limit = 10
    LOAD R2, 128      ; Memory Pointer starts at 0x80 (128)

COUNT_LOOP:
    CMP R0, 11
    JZ COUNT_DONE     ; If counter > 10, exit
    
    MOV ACC, R0
    STORE ACC, [0x80] ; Save counter in RAM 0x80
    
    INC R0            ; R0++
    JMP COUNT_LOOP

COUNT_DONE:
    LOAD ACC, 255     ; Completion marker
    HALT
`
    };

    // =========================================================================
    // UI CONTROLLER & EVENT BINDINGS
    // =========================================================================
    class UIController {
        constructor(vm) {
            this.vm = vm;
            this.runTimer = null;
            this.clockSpeedHz = 10; // Default 10 Hz
            this.activeTab = 'all';

            this.initDOM();
            this.initEvents();
            this.buildMemoryGrid();
            this.loadSample('fibonacci');
        }

        initDOM() {
            this.dom = {
                sampleSelect: document.getElementById('sample-program-select'),
                statusBadge: document.getElementById('system-status-badge'),
                statusText: document.getElementById('status-text'),
                
                // Code Editor
                assemblyText: document.getElementById('assembly-code'),
                lineNumbers: document.getElementById('line-numbers'),
                bytecodeOutput: document.getElementById('bytecode-output'),
                bytecodeSize: document.getElementById('bytecode-size'),
                consoleOutput: document.getElementById('console-output'),
                
                // Buttons
                btnAssemble: document.getElementById('btn-assemble'),
                btnClearCode: document.getElementById('btn-clear-code'),
                btnClearConsole: document.getElementById('btn-clear-console'),
                btnRun: document.getElementById('btn-run'),
                btnPause: document.getElementById('btn-pause'),
                btnStep: document.getElementById('btn-step'),
                btnReset: document.getElementById('btn-reset'),
                btnCheatSheet: document.getElementById('btn-cheat-sheet'),
                btnCloseModal: document.getElementById('btn-close-modal'),
                modalCheatSheet: document.getElementById('modal-cheat-sheet'),
                
                // Debug Pipeline & Speed
                speedSlider: document.getElementById('speed-slider'),
                speedValue: document.getElementById('speed-value'),
                currInstructionText: document.getElementById('curr-instruction-text'),
                currPcAddr: document.getElementById('curr-pc-addr'),
                currOpcode: document.getElementById('curr-opcode'),
                cycleCount: document.getElementById('cycle-count'),
                
                // Registers
                regPC: document.getElementById('reg-PC'),
                regPCDec: document.getElementById('reg-PC-dec'),
                regSP: document.getElementById('reg-SP'),
                regSPDec: document.getElementById('reg-SP-dec'),
                regACC: document.getElementById('reg-ACC'),
                regACCDec: document.getElementById('reg-ACC-dec'),
                regR0: document.getElementById('reg-R0'),
                regR0Dec: document.getElementById('reg-R0-dec'),
                regR1: document.getElementById('reg-R1'),
                regR1Dec: document.getElementById('reg-R1-dec'),
                regR2: document.getElementById('reg-R2'),
                regR2Dec: document.getElementById('reg-R2-dec'),
                regR3: document.getElementById('reg-R3'),
                regR3Dec: document.getElementById('reg-R3-dec'),
                
                // Register Cards for Animations
                regCards: {
                    PC: document.getElementById('reg-card-PC'),
                    SP: document.getElementById('reg-card-SP'),
                    ACC: document.getElementById('reg-card-ACC'),
                    R0: document.getElementById('reg-card-R0'),
                    R1: document.getElementById('reg-card-R1'),
                    R2: document.getElementById('reg-card-R2'),
                    R3: document.getElementById('reg-card-R3')
                },
                
                // Flags
                flagZ: document.getElementById('flag-Z'),
                flagC: document.getElementById('flag-C'),
                flagN: document.getElementById('flag-N'),
                
                // Memory & Stack
                memoryGrid: document.getElementById('memory-grid'),
                hoverAddressInfo: document.getElementById('hover-address-info'),
                stackViewContainer: document.getElementById('stack-view-container'),
                stackTopAddr: document.getElementById('stack-top-addr'),
                memoryTabs: document.getElementById('memory-tabs')
            };
        }

        initEvents() {
            // Line numbers update & sync scroll
            this.dom.assemblyText.addEventListener('input', () => this.updateLineNumbers());
            this.dom.assemblyText.addEventListener('scroll', () => {
                this.dom.lineNumbers.scrollTop = this.dom.assemblyText.scrollTop;
            });

            // Sample program change
            this.dom.sampleSelect.addEventListener('change', (e) => {
                this.loadSample(e.target.value);
            });

            // Buttons
            this.dom.btnAssemble.addEventListener('click', () => this.assembleCode());
            this.dom.btnClearCode.addEventListener('click', () => {
                this.dom.assemblyText.value = '';
                this.updateLineNumbers();
            });
            this.dom.btnClearConsole.addEventListener('click', () => {
                this.dom.consoleOutput.innerHTML = '';
            });

            this.dom.btnRun.addEventListener('click', () => this.runVM());
            this.dom.btnPause.addEventListener('click', () => this.pauseVM());
            this.dom.btnStep.addEventListener('click', () => this.stepVM());
            this.dom.btnReset.addEventListener('click', () => this.resetVM());

            // Speed Slider
            this.dom.speedSlider.addEventListener('input', (e) => {
                this.clockSpeedHz = parseInt(e.target.value, 10);
                this.dom.speedValue.textContent = `${this.clockSpeedHz} Hz`;
                if (this.vm.status === 'RUNNING') {
                    this.pauseVM();
                    this.runVM();
                }
            });

            // Memory Tab Filtering
            this.dom.memoryTabs.addEventListener('click', (e) => {
                if (e.target.classList.contains('tab-btn')) {
                    Array.from(this.dom.memoryTabs.children).forEach(btn => btn.classList.remove('active'));
                    e.target.classList.add('active');
                    this.activeTab = e.target.dataset.range;
                    this.filterMemoryGrid();
                }
            });

            // Modal Controls
            this.dom.btnCheatSheet.addEventListener('click', () => {
                this.dom.modalCheatSheet.classList.add('open');
            });
            this.dom.btnCloseModal.addEventListener('click', () => {
                this.dom.modalCheatSheet.classList.remove('open');
            });
            this.dom.modalCheatSheet.addEventListener('click', (e) => {
                if (e.target === this.dom.modalCheatSheet) {
                    this.dom.modalCheatSheet.classList.remove('open');
                }
            });

            // Keyboard Shortcuts
            window.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.key === 'Enter') {
                    e.preventDefault();
                    this.assembleCode();
                } else if (e.key === 'F5') {
                    e.preventDefault();
                    if (this.vm.status === 'RUNNING') this.pauseVM();
                    else this.runVM();
                } else if (e.key === 'F10') {
                    e.preventDefault();
                    this.stepVM();
                } else if (e.key === 'Escape') {
                    if (this.dom.modalCheatSheet.classList.contains('open')) {
                        this.dom.modalCheatSheet.classList.remove('open');
                    } else {
                        this.resetVM();
                    }
                }
            });
        }

        updateLineNumbers() {
            const lines = this.dom.assemblyText.value.split('\n').length;
            this.dom.lineNumbers.innerHTML = Array.from({ length: lines }, (_, i) => i + 1).join('<br>');
        }

        logConsole(type, text) {
            const div = document.createElement('div');
            div.className = `log-entry ${type}`;
            div.textContent = text;
            this.dom.consoleOutput.appendChild(div);
            this.dom.consoleOutput.scrollTop = this.dom.consoleOutput.scrollHeight;
        }

        loadSample(sampleKey) {
            if (SAMPLE_PROGRAMS[sampleKey]) {
                this.pauseVM();
                this.dom.assemblyText.value = SAMPLE_PROGRAMS[sampleKey];
                this.updateLineNumbers();
                this.logConsole('info', `Loaded preset sample program: '${sampleKey}'`);
                this.assembleCode();
            }
        }

        assembleCode() {
            this.pauseVM();
            const sourceCode = this.dom.assemblyText.value;
            
            try {
                const result = Assembler.assemble(sourceCode);
                
                // Reset VM and load compiled memory
                this.vm.reset();
                this.vm.memory.set(result.bytecode);
                this.vm.sourceMap = result.sourceMap;
                this.vm.disassemblyMap = result.disassemblyMap;
                this.vm.programSize = result.size;

                // Log outputs
                result.logs.forEach(log => this.logConsole(log.type, log.text));
                
                // Update Bytecode UI
                this.renderBytecodeView(result.bytecode, result.size);
                this.updateUI();
                this.setStatus('IDLE');

            } catch (err) {
                this.logConsole('error', `[COMPILE ERROR] ${err.message}`);
                this.setStatus('ERROR');
            }
        }

        renderBytecodeView(bytecode, size) {
            this.dom.bytecodeSize.textContent = `${size} Bytes`;
            if (size === 0) {
                this.dom.bytecodeOutput.innerHTML = '<span class="placeholder-text">No bytecode generated.</span>';
                return;
            }

            let hexHTML = '';
            for (let i = 0; i < size; i++) {
                const hex = bytecode[i].toString(16).padStart(2, '0').toUpperCase();
                const isPC = (i === this.vm.registers.PC);
                hexHTML += `<span class="hex-byte ${isPC ? 'pc-highlight' : ''}" id="hex-byte-${i}">0x${hex}</span> `;
            }
            this.dom.bytecodeOutput.innerHTML = hexHTML;
        }

        buildMemoryGrid() {
            this.dom.memoryGrid.innerHTML = '';
            for (let i = 0; i < MEMORY_SIZE; i++) {
                const cell = document.createElement('div');
                cell.className = 'mem-cell';
                cell.id = `mem-cell-${i}`;
                cell.textContent = '00';

                // Mouseover inspector
                cell.addEventListener('mouseenter', () => {
                    const val = this.vm.memory[i];
                    const hexAddr = `0x${i.toString(16).padStart(2, '0').toUpperCase()}`;
                    const hexVal = `0x${val.toString(16).padStart(2, '0').toUpperCase()}`;
                    const ascii = (val >= 32 && val <= 126) ? `'${String.fromCharCode(val)}'` : 'N/A';
                    
                    let role = 'RAM Data';
                    if (i < this.vm.programSize) role = 'Code Byte';
                    else if (i >= 0xD0) role = 'Stack Memory';

                    this.dom.hoverAddressInfo.innerHTML = `Addr: <strong>${hexAddr} (${i})</strong> | Val: <strong>${hexVal} (${val})</strong> | ASCII: <strong>${ascii}</strong> | Section: <strong>${role}</strong>`;
                });

                cell.addEventListener('mouseleave', () => {
                    this.dom.hoverAddressInfo.textContent = 'Hover over a memory cell...';
                });

                this.dom.memoryGrid.appendChild(cell);
            }
        }

        filterMemoryGrid() {
            for (let i = 0; i < MEMORY_SIZE; i++) {
                const cell = document.getElementById(`mem-cell-${i}`);
                if (!cell) continue;

                let visible = true;
                if (this.activeTab === 'code' && i >= 0x40) visible = false;
                if (this.activeTab === 'ram' && (i < 0x80 || i > 0xCF)) visible = false;
                if (this.activeTab === 'stack' && i < 0xD0) visible = false;

                cell.style.display = visible ? 'flex' : 'none';
            }
        }

        runVM() {
            if (this.vm.status === 'RUNNING') return;
            if (this.vm.status === 'HALTED' || this.vm.status === 'ERROR') {
                this.vm.reset();
            }

            this.setStatus('RUNNING');
            const intervalMs = Math.max(10, Math.floor(1000 / this.clockSpeedHz));

            this.runTimer = setInterval(() => {
                try {
                    const stepSuccess = this.vm.step();
                    this.updateUI();
                    
                    if (!stepSuccess) {
                        this.pauseVM();
                        this.setStatus(this.vm.status);
                        this.logConsole('info', `[CPU] Program completed. Total Cycles: ${this.vm.cycleCount}`);
                    }
                } catch (err) {
                    this.pauseVM();
                    this.setStatus('ERROR');
                    this.logConsole('error', `[RUNTIME ERROR] ${err.message}`);
                }
            }, intervalMs);
        }

        pauseVM() {
            if (this.runTimer) {
                clearInterval(this.runTimer);
                this.runTimer = null;
            }
            if (this.vm.status === 'RUNNING') {
                this.setStatus('PAUSED');
            }
        }

        stepVM() {
            if (this.vm.status === 'RUNNING') this.pauseVM();
            if (this.vm.status === 'HALTED' || this.vm.status === 'ERROR') {
                this.vm.reset();
            }

            try {
                const stepSuccess = this.vm.step();
                this.updateUI();
                if (!stepSuccess) {
                    this.setStatus(this.vm.status);
                    this.logConsole('info', `[CPU] Program completed. Total Cycles: ${this.vm.cycleCount}`);
                } else {
                    this.setStatus('PAUSED');
                }
            } catch (err) {
                this.setStatus('ERROR');
                this.logConsole('error', `[RUNTIME ERROR] ${err.message}`);
            }
        }

        resetVM() {
            this.pauseVM();
            this.vm.reset();
            this.updateUI();
            this.setStatus('IDLE');
            this.logConsole('info', '[CPU] Registers and memory reset to default state.');
        }

        setStatus(status) {
            this.vm.status = status;
            this.dom.statusText.textContent = status;
            this.dom.statusBadge.className = `system-status-badge ${status.toLowerCase()}`;

            const isRunning = (status === 'RUNNING');
            this.dom.btnRun.disabled = isRunning;
            this.dom.btnPause.disabled = !isRunning;
        }

        updateUI() {
            const regs = this.vm.registers;
            const flags = this.vm.flags;

            // 1. Update Registers
            this.updateRegisterField('PC', regs.PC);
            this.updateRegisterField('SP', regs.SP);
            this.updateRegisterField('ACC', regs.ACC);
            this.updateRegisterField('R0', regs.R0);
            this.updateRegisterField('R1', regs.R1);
            this.updateRegisterField('R2', regs.R2);
            this.updateRegisterField('R3', regs.R3);

            // 2. Update Flags
            this.dom.flagZ.classList.toggle('active', flags.Z === 1);
            this.dom.flagC.classList.toggle('active', flags.C === 1);
            this.dom.flagN.classList.toggle('active', flags.N === 1);

            // 3. Update Pipeline Card
            const pcAddr = regs.PC;
            const opcode = this.vm.memory[pcAddr];
            const meta = this.vm.disassemblyMap[pcAddr];

            this.dom.currPcAddr.textContent = `0x${pcAddr.toString(16).padStart(2, '0').toUpperCase()}`;
            this.dom.currOpcode.textContent = `0x${opcode.toString(16).padStart(2, '0').toUpperCase()}`;
            this.dom.cycleCount.textContent = this.vm.cycleCount;

            if (meta) {
                this.dom.currInstructionText.textContent = meta.rawText;
            } else if (opcode === 0x00) {
                this.dom.currInstructionText.textContent = '-- HALT / NOP --';
            } else {
                this.dom.currInstructionText.textContent = `DATA BYTE: 0x${opcode.toString(16).padStart(2, '0').toUpperCase()}`;
            }

            // 4. Update Memory Grid Cells
            for (let i = 0; i < MEMORY_SIZE; i++) {
                const val = this.vm.memory[i];
                const cell = document.getElementById(`mem-cell-${i}`);
                if (!cell) continue;

                const hexVal = val.toString(16).padStart(2, '0').toUpperCase();
                cell.textContent = hexVal;

                // Reset classes
                cell.className = 'mem-cell';
                
                if (i < this.vm.programSize) cell.classList.add('is-code');
                else if (i >= 0x80 && i <= 0xCF) cell.classList.add('is-ram');
                else if (i >= 0xD0) cell.classList.add('is-stack');

                if (i === regs.PC) cell.classList.add('is-pc');
                if (i === regs.SP) cell.classList.add('is-sp');
            }

            // 5. Update Bytecode Hex Highlights
            const bytecodeSize = this.vm.programSize;
            for (let i = 0; i < bytecodeSize; i++) {
                const span = document.getElementById(`hex-byte-${i}`);
                if (span) {
                    span.classList.toggle('pc-highlight', i === regs.PC);
                }
            }

            // 6. Update Stack Tower Inspector
            this.updateStackView();
        }

        updateRegisterField(regName, val) {
            const hexText = `0x${val.toString(16).padStart(2, '0').toUpperCase()}`;
            const decText = `(${val})`;
            
            const hexElem = this.dom[`reg${regName}`];
            const decElem = this.dom[`reg${regName}Dec`];
            const cardElem = this.dom.regCards[regName];

            if (hexElem && hexElem.textContent !== hexText) {
                hexElem.textContent = hexText;
                if (decElem) decElem.textContent = decText;

                // Trigger flash update animation
                if (cardElem) {
                    cardElem.classList.remove('updated');
                    void cardElem.offsetWidth; // Trigger reflow
                    cardElem.classList.add('updated');
                }
            }
        }

        updateStackView() {
            this.dom.stackTopAddr.textContent = `0x${this.vm.registers.SP.toString(16).padStart(2, '0').toUpperCase()}`;
            
            // Rebuild Stack Inspector Tower
            const items = [];
            for (let addr = 0xFF; addr > this.vm.registers.SP; addr--) {
                const val = this.vm.memory[addr];
                items.push(`
                    <div class="stack-item">
                        <span class="stack-item-addr">0x${addr.toString(16).padStart(2, '0').toUpperCase()}</span>
                        <span class="stack-item-val">0x${val.toString(16).padStart(2, '0').toUpperCase()} (${val})</span>
                    </div>
                `);
            }

            if (items.length === 0) {
                this.dom.stackViewContainer.innerHTML = '<div class="empty-stack-msg">Stack is currently empty (SP at 0xFF)</div>';
            } else {
                this.dom.stackViewContainer.innerHTML = items.join('');
            }
        }
    }

    // Initialize Application on DOM Ready
    document.addEventListener('DOMContentLoaded', () => {
        const vm = new VirtualMachine();
        window.emulatorUI = new UIController(vm);
    });

})();
