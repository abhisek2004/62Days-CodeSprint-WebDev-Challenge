/**
 * AST Code Minifier & Obfuscator Studio
 * Browser-based Abstract Syntax Tree Engine, Transformer, Visualizer & Optimizer
 */

(function () {
  'use strict';

  // ==========================================================================
  // Sample Code Presets
  // ==========================================================================

  const CODE_SAMPLES = {
    algorithm: `/**
 * QuickSort Algorithm & Binary Search Demo
 * High performance array sorting and log-n searching
 */
function quickSort(array, left = 0, right = array.length - 1) {
  // Base case for recursion
  if (left >= right) {
    return array;
  }
  
  const pivotIndex = partition(array, left, right);
  quickSort(array, left, pivotIndex - 1);
  quickSort(array, pivotIndex + 1, right);
  
  return array;
}

function partition(arr, start, end) {
  const pivotValue = arr[end];
  let pivotIndex = start;
  
  for (let i = start; i < end; i++) {
    if (arr[i] < pivotValue) {
      // Swap elements
      const temp = arr[i];
      arr[i] = arr[pivotIndex];
      arr[pivotIndex] = temp;
      pivotIndex++;
    }
  }
  
  // Swap pivot to correct location
  const temp = arr[pivotIndex];
  arr[pivotIndex] = arr[end];
  arr[end] = temp;
  
  return pivotIndex;
}

function binarySearch(arr, target) {
  let low = 0;
  let high = arr.length - 1;
  
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const guess = arr[mid];
    
    if (guess === target) {
      return mid;
    } else if (guess > target) {
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }
  
  return -1;
}

// Execution test
const sampleData = [64, 34, 25, 12, 22, 11, 90, 88];
console.log("Original Array:", sampleData);
const sorted = quickSort(sampleData);
console.log("Sorted Array:", sorted);
const searchIndex = binarySearch(sorted, 25);
console.log("Found 25 at index:", searchIndex);`,

    ui_handler: `/**
 * UI Modal & Toast Notification Manager
 * Handles DOM modal creation, animations, and async toasts
 */
class NotificationManager {
  constructor(containerId = "toast-root") {
    this.container = document.getElementById(containerId);
    this.timeoutMs = 4000;
    this.activeToasts = [];
  }

  showToast(message, type = "info") {
    const toastElem = document.createElement("div");
    toastElem.className = "toast-item toast-" + type;
    toastElem.innerText = message;
    
    const closeBtn = document.createElement("button");
    closeBtn.className = "toast-close";
    closeBtn.innerHTML = "&times;";
    closeBtn.onclick = () => this.dismiss(toastElem);
    
    toastElem.appendChild(closeBtn);
    if (this.container) {
      this.container.appendChild(toastElem);
    }
    
    this.activeToasts.push(toastElem);
    console.log("Toast displayed: " + message);
    
    setTimeout(() => {
      this.dismiss(toastElem);
    }, this.timeoutMs);
  }

  dismiss(toastElem) {
    toastElem.classList.add("fade-out");
    setTimeout(() => {
      if (toastElem.parentNode) {
        toastElem.parentNode.removeChild(toastElem);
      }
      this.activeToasts = this.activeToasts.filter(t => t !== toastElem);
    }, 300);
  }

  clearAll() {
    this.activeToasts.forEach(t => this.dismiss(t));
  }
}

const notifier = new NotificationManager("notification-root");
notifier.showToast("System booted successfully", "success");`,

    utility: `/**
 * Utility Function Toolkit
 * Collection of essential helpers (deep clone, debounce, math)
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    const copy = [];
    for (let i = 0; i < obj.length; i++) {
      copy[i] = deepClone(obj[i]);
    }
    return copy;
  }
  
  const result = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      result[key] = deepClone(obj[key]);
    }
  }
  return result;
}

function debounce(func, delay = 300) {
  let timerId = null;
  return function (...args) {
    const context = this;
    if (timerId) {
      clearTimeout(timerId);
    }
    timerId = setTimeout(() => {
      func.apply(context, args);
    }, delay);
  };
}

function calculateFinancials(principal, rate, years) {
  const compoundMultiplier = Math.pow(1 + rate / 100, years);
  const totalAmount = principal * compoundMultiplier;
  const interestEarned = totalAmount - principal;
  
  return {
    principal: principal,
    total: Math.round(totalAmount * 100) / 100,
    interest: Math.round(interestEarned * 100) / 100
  };
}

console.log("Financial Calc:", calculateFinancials(10000, 5, 10));`,

    complex_app: `/**
 * Reactive State Store & Event Emitter
 * Pattern implementation for modular web applications
 */
class StateStore {
  constructor(initialState = {}) {
    this.state = initialState;
    this.listeners = new Map();
  }

  getState() {
    return Object.freeze({ ...this.state });
  }

  subscribe(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    const handlers = this.listeners.get(event);
    handlers.push(callback);

    // Return unsubscribe function
    return () => {
      const idx = handlers.indexOf(callback);
      if (idx > -1) {
        handlers.splice(idx, 1);
      }
    };
  }

  dispatch(event, payload) {
    if (payload && typeof payload === "object") {
      this.state = { ...this.state, ...payload };
    }
    
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      callbacks.forEach(fn => fn(this.state, payload));
    }
    console.log("Event dispatched: " + event, payload);
  }
}

const store = new StateStore({ user: "Alice", isAuth: true, cart: [] });
const unsub = store.subscribe("cart_add", (state) => {
  console.log("Cart updated. Total items:", state.cart.length);
});

store.dispatch("cart_add", { cart: [{ id: 101, title: "Book", price: 29.99 }] });`
  };

  // List of Built-in JavaScript Keywords & Globals to avoid mangling
  const GLOBAL_IDENTIFIERS = new Set([
    'Array', 'Boolean', 'Date', 'Error', 'Function', 'JSON', 'Math', 'Number',
    'Object', 'Promise', 'RegExp', 'String', 'Symbol', 'Map', 'Set', 'WeakMap',
    'console', 'document', 'window', 'globalThis', 'setTimeout', 'clearTimeout',
    'setInterval', 'clearInterval', 'parseInt', 'parseFloat', 'encodeURIComponent',
    'decodeURIComponent', 'isNaN', 'isFinite', 'undefined', 'null', 'true', 'false',
    'Infinity', 'NaN', 'eval', 'arguments', 'this', 'super', 'new', 'typeof',
    'instanceof', 'void', 'delete', 'in', 'return', 'if', 'else', 'for', 'while',
    'do', 'break', 'continue', 'switch', 'case', 'default', 'try', 'catch', 'finally',
    'throw', 'class', 'extends', 'const', 'let', 'var', 'function', 'import', 'export',
    'log', 'innerText', 'innerHTML', 'appendChild', 'removeChild', 'createElement',
    'getElementById', 'querySelector', 'querySelectorAll', 'addEventListener', 'push',
    'pop', 'shift', 'unshift', 'splice', 'slice', 'indexOf', 'filter', 'map', 'forEach',
    'reduce', 'apply', 'call', 'bind', 'length', 'name', 'prototype', 'toString'
  ]);

  // Default Settings State
  const state = {
    sourceCode: CODE_SAMPLES.algorithm,
    ast: null,
    minifiedCode: '',
    parseTimeMs: 0,
    selectedAstNode: null,
    settings: {
      stripWhitespace: true,
      stripComments: true,
      removeConsole: true,
      constantFolding: true,
      mangleVariables: 'alpha', // 'alpha', 'hex', 'emoji', 'none'
      mangleFunctions: true,
      preserveGlobals: true,
      stringEncoding: 'hex', // 'none', 'hex', 'array'
      deadCode: true,
      hexNumbers: false
    }
  };

  // DOM Cache
  const dom = {};

  // ==========================================================================
  // Custom Built-in Lightweight JavaScript AST Parser & Tokenizer
  // ==========================================================================

  function parseJS(code) {
    // If Acorn library is loaded from CDN, attempt to use Acorn first for full ES6+ support!
    if (window.acorn && typeof window.acorn.parse === 'function') {
      try {
        const acornAst = window.acorn.parse(code, {
          ecmaVersion: 'latest',
          sourceType: 'script',
          locations: true
        });
        return acornAst;
      } catch (err) {
        // Fallback to built-in parser if Acorn encounters syntax issue
      }
    }

    // Lightweight Native Fallback AST Parser Engine
    let pos = 0;
    const len = code.length;

    function isWhitespace(ch) {
      return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';
    }

    function isAlpha(ch) {
      return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_' || ch === '$';
    }

    function isDigit(ch) {
      return ch >= '0' && ch <= '9';
    }

    function skipWhitespaceAndComments() {
      while (pos < len) {
        const ch = code[pos];
        if (isWhitespace(ch)) {
          pos++;
        } else if (ch === '/' && code[pos + 1] === '/') {
          pos += 2;
          while (pos < len && code[pos] !== '\n') pos++;
        } else if (ch === '/' && code[pos + 1] === '*') {
          pos += 2;
          while (pos < len && !(code[pos] === '*' && code[pos + 1] === '/')) pos++;
          pos += 2;
        } else {
          break;
        }
      }
    }

    function parseIdentifierOrKeyword() {
      const start = pos;
      while (pos < len && (isAlpha(code[pos]) || isDigit(code[pos]))) {
        pos++;
      }
      return code.slice(start, pos);
    }

    function parseNumber() {
      const start = pos;
      while (pos < len && (isDigit(code[pos]) || code[pos] === '.')) {
        pos++;
      }
      const raw = code.slice(start, pos);
      return { type: 'Literal', value: Number(raw), raw: raw };
    }

    function parseString() {
      const quote = code[pos++];
      const start = pos;
      let val = '';
      while (pos < len && code[pos] !== quote) {
        if (code[pos] === '\\') pos++;
        val += code[pos++];
      }
      pos++; // skip closing quote
      return { type: 'Literal', value: val, raw: quote + val + quote };
    }

    function parseStatement() {
      skipWhitespaceAndComments();
      if (pos >= len) return null;

      const startPos = pos;
      let word = '';

      if (isAlpha(code[pos])) {
        const oldPos = pos;
        word = parseIdentifierOrKeyword();

        if (word === 'function') {
          skipWhitespaceAndComments();
          const name = parseIdentifierOrKeyword();
          skipWhitespaceAndComments();
          // Params
          const params = [];
          if (code[pos] === '(') {
            pos++;
            while (pos < len && code[pos] !== ')') {
              skipWhitespaceAndComments();
              if (isAlpha(code[pos])) {
                const paramName = parseIdentifierOrKeyword();
                params.push({ type: 'Identifier', name: paramName });
                skipWhitespaceAndComments();
                if (code[pos] === '=') {
                  pos++;
                  while (pos < len && code[pos] !== ',' && code[pos] !== ')') pos++;
                }
                if (code[pos] === ',') pos++;
              } else {
                pos++;
              }
            }
            if (code[pos] === ')') pos++;
          }
          skipWhitespaceAndComments();
          const body = parseBlock();
          return {
            type: 'FunctionDeclaration',
            id: { type: 'Identifier', name: name },
            params: params,
            body: body
          };
        } else if (word === 'const' || word === 'let' || word === 'var') {
          skipWhitespaceAndComments();
          const declarations = [];
          while (pos < len && code[pos] !== ';') {
            const varName = parseIdentifierOrKeyword();
            skipWhitespaceAndComments();
            let initNode = null;
            if (code[pos] === '=') {
              pos++;
              skipWhitespaceAndComments();
              initNode = parseExpression();
            }
            declarations.push({
              type: 'VariableDeclarator',
              id: { type: 'Identifier', name: varName },
              init: initNode
            });
            skipWhitespaceAndComments();
            if (code[pos] === ',') pos++;
            else break;
          }
          if (code[pos] === ';') pos++;
          return {
            type: 'VariableDeclaration',
            kind: word,
            declarations: declarations
          };
        } else if (word === 'return') {
          skipWhitespaceAndComments();
          let argument = null;
          if (code[pos] !== ';') {
            argument = parseExpression();
          }
          if (code[pos] === ';') pos++;
          return { type: 'ReturnStatement', argument: argument };
        } else if (word === 'if') {
          skipWhitespaceAndComments();
          if (code[pos] === '(') pos++;
          const test = parseExpression();
          if (code[pos] === ')') pos++;
          const consequent = parseStatement();
          return { type: 'IfStatement', test: test, consequent: consequent };
        } else {
          // Reset pos to parse expression statement
          pos = oldPos;
        }
      }

      if (code[pos] === '{') {
        return parseBlock();
      }

      // Default to generic ExpressionStatement
      const expr = parseExpression();
      if (code[pos] === ';') pos++;
      return { type: 'ExpressionStatement', expression: expr };
    }

    function parseBlock() {
      skipWhitespaceAndComments();
      if (code[pos] === '{') pos++;
      const body = [];
      while (pos < len && code[pos] !== '}') {
        const stmt = parseStatement();
        if (stmt) body.push(stmt);
        skipWhitespaceAndComments();
      }
      if (code[pos] === '}') pos++;
      return { type: 'BlockStatement', body: body };
    }

    function parseExpression() {
      skipWhitespaceAndComments();
      if (pos >= len) return null;

      let left = parsePrimary();
      skipWhitespaceAndComments();

      // Check binary operators
      if (pos < len && ['+', '-', '*', '/', '=', '>', '<', '!'].includes(code[pos])) {
        const opStart = pos;
        while (pos < len && ['+', '-', '*', '/', '=', '>', '<', '!'].includes(code[pos])) pos++;
        const operator = code.slice(opStart, pos);
        skipWhitespaceAndComments();
        const right = parseExpression();
        return {
          type: 'BinaryExpression',
          operator: operator,
          left: left,
          right: right
        };
      }

      return left;
    }

    function parsePrimary() {
      skipWhitespaceAndComments();
      const ch = code[pos];

      if (ch === '"' || ch === "'") {
        return parseString();
      } else if (isDigit(ch)) {
        return parseNumber();
      } else if (isAlpha(ch)) {
        const idName = parseIdentifierOrKeyword();
        skipWhitespaceAndComments();
        // Check function call
        if (code[pos] === '(') {
          pos++;
          const args = [];
          while (pos < len && code[pos] !== ')') {
            skipWhitespaceAndComments();
            const arg = parseExpression();
            if (arg) args.push(arg);
            skipWhitespaceAndComments();
            if (code[pos] === ',') pos++;
          }
          if (code[pos] === ')') pos++;
          return {
            type: 'CallExpression',
            callee: { type: 'Identifier', name: idName },
            arguments: args
          };
        }
        return { type: 'Identifier', name: idName };
      } else {
        // Fallback char
        pos++;
        return { type: 'Literal', value: ch, raw: ch };
      }
    }

    // Build root program AST
    const body = [];
    while (pos < len) {
      const stmt = parseStatement();
      if (stmt) body.push(stmt);
      else pos++;
    }

    return {
      type: 'Program',
      body: body,
      sourceType: 'script'
    };
  }

  // Count total AST nodes recursively
  function countAstNodes(node) {
    if (!node || typeof node !== 'object') return 0;
    let count = 1;
    for (const key in node) {
      if (key === 'loc' || key === 'range') continue;
      const child = node[key];
      if (Array.isArray(child)) {
        child.forEach(item => {
          if (item && typeof item === 'object' && item.type) {
            count += countAstNodes(item);
          }
        });
      } else if (child && typeof child === 'object' && child.type) {
        count += countAstNodes(child);
      }
    }
    return count;
  }

  // ==========================================================================
  // AST Transformation & Obfuscation Pipeline
  // ==========================================================================

  function generateMangledName(index, mode) {
    if (mode === 'hex') {
      return `_0x${(index + 0x10a).toString(16)}`;
    } else if (mode === 'emoji') {
      const emojis = ['⚡', '🔥', '🚀', '💎', '✨', '🧠', '🔮', '🎯', '🌊', '🌟'];
      const base = emojis[index % emojis.length];
      const repeat = Math.floor(index / emojis.length) + 1;
      return '_' + base.repeat(repeat);
    } else {
      // Default Short Alphabetical: a, b, c... z, aa, ab...
      let name = '';
      let i = index;
      while (i >= 0) {
        name = String.fromCharCode(97 + (i % 26)) + name;
        i = Math.floor(i / 26) - 1;
      }
      return name;
    }
  }

  function transformAndMinify(ast, settings) {
    const stringTable = [];
    const varMap = new Map();
    let nameCounter = 0;

    // Deep clone AST to prevent mutating visual tree
    const astCopy = JSON.parse(JSON.stringify(ast));

    // Phase 1: Collect & Mangle Identifiers (Scope Walk)
    function collectIdentifiers(node) {
      if (!node || typeof node !== 'object') return;

      // VariableDeclarator / FunctionDeclaration
      if (node.type === 'VariableDeclarator' && node.id && node.id.name) {
        const oldName = node.id.name;
        if (!GLOBAL_IDENTIFIERS.has(oldName) && !varMap.has(oldName)) {
          if (settings.mangleVariables !== 'none') {
            varMap.set(oldName, generateMangledName(nameCounter++, settings.mangleVariables));
          }
        }
      }

      if (node.type === 'FunctionDeclaration') {
        if (node.id && node.id.name && settings.mangleFunctions) {
          const fnName = node.id.name;
          if (!GLOBAL_IDENTIFIERS.has(fnName) && !varMap.has(fnName)) {
            if (settings.mangleVariables !== 'none') {
              varMap.set(fnName, generateMangledName(nameCounter++, settings.mangleVariables));
            }
          }
        }
        if (Array.isArray(node.params)) {
          node.params.forEach(p => {
            if (p.name && !GLOBAL_IDENTIFIERS.has(p.name) && !varMap.has(p.name)) {
              if (settings.mangleVariables !== 'none') {
                varMap.set(p.name, generateMangledName(nameCounter++, settings.mangleVariables));
              }
            }
          });
        }
      }

      // Recurse children
      for (const key in node) {
        if (key === 'loc' || key === 'range') continue;
        const child = node[key];
        if (Array.isArray(child)) child.forEach(collectIdentifiers);
        else if (child && typeof child === 'object') collectIdentifiers(child);
      }
    }

    // Phase 2: Perform AST Transformations (Mutate Copy)
    function transformNode(node, parent) {
      if (!node || typeof node !== 'object') return node;

      // Dead Code Removal: Strip console.log() if enabled
      if (settings.removeConsole && node.type === 'ExpressionStatement') {
        if (node.expression && node.expression.type === 'CallExpression') {
          const callee = node.expression.callee;
          if (
            (callee.type === 'MemberExpression' && callee.object && callee.object.name === 'console') ||
            (callee.type === 'Identifier' && callee.name === 'console')
          ) {
            return null; // Strip console statement
          }
        }
      }

      // Dead Code Removal: Unreachable code after return statement in block
      if (settings.deadCode && node.type === 'BlockStatement' && Array.isArray(node.body)) {
        const newBody = [];
        for (let i = 0; i < node.body.length; i++) {
          const stmt = node.body[i];
          if (stmt) {
            const transformed = transformNode(stmt, node);
            if (transformed) newBody.push(transformed);
            if (stmt.type === 'ReturnStatement') break; // Ignore statements after return!
          }
        }
        node.body = newBody;
        return node;
      }

      // Constant Folding: Binary Expression with numbers (e.g., 2 + 3 -> 5)
      if (settings.constantFolding && node.type === 'BinaryExpression') {
        const left = transformNode(node.left, node);
        const right = transformNode(node.right, node);

        if (left && right && left.type === 'Literal' && right.type === 'Literal') {
          if (typeof left.value === 'number' && typeof right.value === 'number') {
            let res;
            if (node.operator === '+') res = left.value + right.value;
            else if (node.operator === '-') res = left.value - right.value;
            else if (node.operator === '*') res = left.value * right.value;
            else if (node.operator === '/') res = left.value / right.value;

            if (res !== undefined) {
              return { type: 'Literal', value: res, raw: String(res) };
            }
          }
        }
      }

      // Mangle Identifiers
      if (node.type === 'Identifier' && node.name) {
        if (varMap.has(node.name)) {
          node.name = varMap.get(node.name);
        }
      }

      // String Obfuscation
      if (node.type === 'Literal' && typeof node.value === 'string') {
        if (settings.stringEncoding === 'hex') {
          let hexEscaped = '';
          for (let i = 0; i < node.value.length; i++) {
            const hex = node.value.charCodeAt(i).toString(16).padStart(2, '0');
            hexEscaped += '\\x' + hex;
          }
          node.raw = `"${hexEscaped}"`;
        } else if (settings.stringEncoding === 'array') {
          let idx = stringTable.indexOf(node.value);
          if (idx === -1) {
            stringTable.push(node.value);
            idx = stringTable.length - 1;
          }
          // Convert Literal string node to array lookup MemberExpression: _0xStrTable[idx]
          return {
            type: 'MemberExpression',
            object: { type: 'Identifier', name: '_0xStrTable' },
            property: { type: 'Literal', value: idx, raw: String(idx) },
            computed: true
          };
        }
      }

      // Hex Number Encoding
      if (settings.hexNumbers && node.type === 'Literal' && typeof node.value === 'number' && Number.isInteger(node.value)) {
        node.raw = '0x' + node.value.toString(16);
      }

      // Transform subtrees
      for (const key in node) {
        if (key === 'loc' || key === 'range') continue;
        const child = node[key];
        if (Array.isArray(child)) {
          node[key] = child.map(c => transformNode(c, node)).filter(Boolean);
        } else if (child && typeof child === 'object') {
          node[key] = transformNode(child, node);
        }
      }

      return node;
    }

    collectIdentifiers(astCopy);
    const finalAst = transformNode(astCopy, null);

    // Code Generator: Convert AST back to JS string
    let minified = printCode(finalAst, settings.stripWhitespace);

    // Prepend String Table Decoder Array if String Table option active
    if (settings.stringEncoding === 'array' && stringTable.length > 0) {
      const encodedTable = stringTable.map(s => `"${s.replace(/"/g, '\\"')}"`).join(',');
      const tableBoilerplate = settings.stripWhitespace
        ? `const _0xStrTable=[${encodedTable}];`
        : `const _0xStrTable = [${encodedTable}];\n`;
      minified = tableBoilerplate + minified;
    }

    return minified;
  }

  // AST Code Printer
  function printCode(node, compact = true) {
    if (!node || typeof node !== 'object') return '';

    const sep = compact ? '' : ' ';
    const nl = compact ? '' : '\n';

    switch (node.type) {
      case 'Program':
        return node.body.map(n => printCode(n, compact)).join(compact ? ';' : ';\n') + (compact ? '' : ';');

      case 'BlockStatement':
        return '{' + (compact ? '' : ' ') + node.body.map(n => printCode(n, compact)).join(compact ? ';' : ';\n') + (compact ? '' : ' ') + '}';

      case 'FunctionDeclaration': {
        const name = node.id ? printCode(node.id, compact) : '';
        const params = (node.params || []).map(p => printCode(p, compact)).join(',' + sep);
        const body = printCode(node.body, compact);
        return `function ${name}(${params})${sep}${body}`;
      }

      case 'VariableDeclaration': {
        const decls = node.declarations.map(d => printCode(d, compact)).join(',' + sep);
        return `${node.kind} ${decls}`;
      }

      case 'VariableDeclarator': {
        const name = printCode(node.id, compact);
        const init = node.init ? `${sep}=${sep}${printCode(node.init, compact)}` : '';
        return `${name}${init}`;
      }

      case 'ReturnStatement': {
        const arg = node.argument ? ' ' + printCode(node.argument, compact) : '';
        return `return${arg}`;
      }

      case 'IfStatement': {
        const test = printCode(node.test, compact);
        const cons = printCode(node.consequent, compact);
        const alt = node.alternate ? `${sep}else${sep}${printCode(node.alternate, compact)}` : '';
        return `if(${test})${sep}${cons}${alt}`;
      }

      case 'BinaryExpression': {
        const left = printCode(node.left, compact);
        const right = printCode(node.right, compact);
        return `${left}${sep}${node.operator}${sep}${right}`;
      }

      case 'CallExpression': {
        const callee = printCode(node.callee, compact);
        const args = (node.arguments || []).map(a => printCode(a, compact)).join(',' + sep);
        return `${callee}(${args})`;
      }

      case 'MemberExpression': {
        const obj = printCode(node.object, compact);
        const prop = printCode(node.property, compact);
        return node.computed ? `${obj}[${prop}]` : `${obj}.${prop}`;
      }

      case 'Identifier':
        return node.name || '';

      case 'Literal':
        return node.raw !== undefined ? String(node.raw) : String(node.value);

      case 'ExpressionStatement':
        return printCode(node.expression, compact);

      default:
        // Generic fallback printer
        return '';
    }
  }

  // ==========================================================================
  // AST Visualizer DOM Tree Renderer
  // ==========================================================================

  function renderAstTree(node, container, depth = 0, query = '') {
    if (!node || typeof node !== 'object') return;

    container.innerHTML = '';
    const rootElem = document.createElement('div');
    rootElem.className = 'ast-tree';
    buildDomBranch(node, rootElem, 'Root', depth, query.toLowerCase());
    container.appendChild(rootElem);
  }

  function buildDomBranch(node, parentElem, keyName, depth, query) {
    if (!node || typeof node !== 'object' || !node.type) return;

    // Filter check if searching query
    const nodeType = node.type;
    const isMatch = !query || nodeType.toLowerCase().includes(query) || keyName.toLowerCase().includes(query);

    const nodeElem = document.createElement('div');
    nodeElem.className = 'ast-node';

    const header = document.createElement('div');
    header.className = 'ast-node-header';

    // Collapsible Arrow Toggle
    const toggle = document.createElement('span');
    toggle.className = 'ast-toggle';
    toggle.innerHTML = '&#9660;';

    // Type Badge
    const typeBadge = document.createElement('span');
    typeBadge.className = `ast-type type-${nodeType}`;
    typeBadge.textContent = nodeType;

    // Key label
    const keyLabel = document.createElement('span');
    keyLabel.className = 'ast-key';
    keyLabel.textContent = keyName + ':';

    header.appendChild(toggle);
    header.appendChild(keyLabel);
    header.appendChild(typeBadge);

    // Value details
    if (node.name) {
      const valLabel = document.createElement('span');
      valLabel.className = 'ast-val';
      valLabel.textContent = `"${node.name}"`;
      header.appendChild(valLabel);
    } else if (node.value !== undefined) {
      const valLabel = document.createElement('span');
      valLabel.className = 'ast-val';
      valLabel.textContent = JSON.stringify(node.value);
      header.appendChild(valLabel);
    } else if (node.kind) {
      const valLabel = document.createElement('span');
      valLabel.className = 'ast-val';
      valLabel.textContent = `[${node.kind}]`;
      header.appendChild(valLabel);
    }

    nodeElem.appendChild(header);

    // Children container
    const childrenElem = document.createElement('div');
    childrenElem.className = 'ast-children';

    let childCount = 0;
    for (const prop in node) {
      if (prop === 'loc' || prop === 'range' || prop === 'type') continue;
      const val = node[prop];
      if (Array.isArray(val)) {
        val.forEach((item, idx) => {
          if (item && typeof item === 'object' && item.type) {
            buildDomBranch(item, childrenElem, `${prop}[${idx}]`, depth + 1, query);
            childCount++;
          }
        });
      } else if (val && typeof val === 'object' && val.type) {
        buildDomBranch(val, childrenElem, prop, depth + 1, query);
        childCount++;
      }
    }

    if (childCount === 0) {
      toggle.style.opacity = '0.3';
    } else {
      header.onclick = (e) => {
        e.stopPropagation();
        const isCollapsed = childrenElem.classList.toggle('collapsed');
        toggle.classList.toggle('collapsed', isCollapsed);
      };
    }

    // Selection & Inspector Click Event
    header.addEventListener('click', () => {
      document.querySelectorAll('.ast-node-header.selected').forEach(el => el.classList.remove('selected'));
      header.classList.add('selected');
      state.selectedAstNode = node;
      updateInspectorCard(node);
    });

    if (isMatch) {
      nodeElem.appendChild(childrenElem);
      parentElem.appendChild(nodeElem);
    }
  }

  function updateInspectorCard(node) {
    if (!dom.inspectorCard) return;
    if (!node) {
      dom.inspectorCard.innerHTML = `<p class="inspector-hint">Select a node in the tree to inspect raw properties.</p>`;
      return;
    }

    const jsonStr = JSON.stringify(node, null, 2);
    dom.inspectorCard.innerHTML = `
      <h4>AST Node Inspector: <span class="highlight-purple">${node.type}</span></h4>
      <table class="inspector-table">
        <tr><th>Property</th><th>Value</th></tr>
        <tr><td>Node Type</td><td><code>${node.type}</code></td></tr>
        ${node.name ? `<tr><td>Identifier Name</td><td><code>${node.name}</code></td></tr>` : ''}
        ${node.kind ? `<tr><td>Declaration Kind</td><td><code>${node.kind}</code></td></tr>` : ''}
        ${node.value !== undefined ? `<tr><td>Literal Value</td><td><code>${JSON.stringify(node.value)}</code></td></tr>` : ''}
        ${node.operator ? `<tr><td>Operator</td><td><code>${node.operator}</code></td></tr>` : ''}
      </table>
      <div style="margin-top: 10px;">
        <h5 style="color: var(--text-muted); font-size: 0.75rem;">Raw JSON Schema:</h5>
        <pre class="json-code" style="max-height: 180px; overflow: auto; margin-top: 4px;">${jsonStr}</pre>
      </div>
    `;
  }

  // ==========================================================================
  // Pipeline Execution & Metric Calculations
  // ==========================================================================

  function runAstPipeline() {
    const startTime = performance.now();
    const source = dom.sourceCodeInput.value || '';

    state.sourceCode = source;

    try {
      // 1. Parse JS to AST
      const ast = parseJS(source);
      state.ast = ast;

      // 2. Count total AST nodes
      const totalNodes = countAstNodes(ast);
      dom.astNodeCount.textContent = totalNodes;

      // 3. Render AST visual tree & JSON
      renderAstTree(ast, dom.astTreeContainer, 0, dom.astSearchInput.value);
      dom.astJsonOutput.textContent = JSON.stringify(ast, null, 2);

      // 4. Run AST Transformation & Minifier
      const minified = transformAndMinify(ast, state.settings);
      state.minifiedCode = minified;
      dom.outputCodeViewer.value = minified;

      // 5. Update Line Numbers
      updateLineNumbers(dom.sourceCodeInput, dom.sourceLineNumbers);
      updateLineNumbers(dom.outputCodeViewer, dom.outputLineNumbers);

      const parseTime = Math.round(performance.now() - startTime);
      state.parseTimeMs = parseTime;
      dom.parseTimeBadge.textContent = `Parse Time: ${parseTime}ms`;

      // 6. Recalculate Compression Metrics
      updateMetrics(source, minified);

    } catch (err) {
      console.error('AST Parser Error:', err);
      dom.outputCodeViewer.value = `// AST Syntax Error:\n// ${err.message}`;
    }
  }

  function updateMetrics(origText, minText) {
    const origBytes = new Blob([origText]).size;
    const minBytes = new Blob([minText]).size;
    const savedBytes = Math.max(0, origBytes - minBytes);
    const savingsPct = origBytes > 0 ? Math.round((savedBytes / origBytes) * 100) : 0;
    const ratio = minBytes > 0 ? (origBytes / minBytes).toFixed(2) : '1.00';
    const estGzipBytes = Math.round(minBytes * 0.45);

    // Format Bytes
    dom.sourceCharCount.textContent = `${origText.length} chars`;
    dom.sourceSizeBadge.textContent = formatBytes(origBytes);
    dom.outputCharCount.textContent = `${minText.length} chars`;
    dom.outputSizeBadge.textContent = formatBytes(minBytes);
    dom.savingsBadge.textContent = `${savingsPct}% saved`;

    dom.valOrigSize.textContent = formatBytes(origBytes);
    dom.valMinSize.textContent = formatBytes(minBytes);
    dom.valSavedBytes.textContent = formatBytes(savedBytes);
    dom.valSavingsPct.textContent = `${savingsPct}%`;
    dom.valRatio.textContent = `${ratio} : 1`;
    dom.valGzip.textContent = formatBytes(estGzipBytes);

    // Visual Meter Progress Bar
    const minifiedWidth = origBytes > 0 ? Math.min(100, Math.round((minBytes / origBytes) * 100)) : 100;
    dom.meterFill.style.width = `${minifiedWidth}%`;
    dom.meterMinPct.textContent = `${minifiedWidth}%`;
    dom.meterSavingsPct.textContent = `${savingsPct}%`;
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function updateLineNumbers(textarea, lineNumContainer) {
    if (!textarea || !lineNumContainer) return;
    const lines = textarea.value.split('\n').length;
    let numbersHtml = '';
    for (let i = 1; i <= lines; i++) {
      numbersHtml += i + '<br>';
    }
    lineNumContainer.innerHTML = numbersHtml;
  }

  function showToast(msg) {
    dom.toastMessage.textContent = msg;
    dom.toast.classList.remove('hidden');
    setTimeout(() => {
      dom.toast.classList.add('hidden');
    }, 3000);
  }

  // Debounced input handler
  function debounce(fn, delay = 200) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  // ==========================================================================
  // Event Listeners & UI Binding
  // ==========================================================================

  function initUI() {
    // Cache DOM Elements
    dom.samplePresetSelect = document.getElementById('samplePresetSelect');
    dom.btnProcessCode = document.getElementById('btnProcessCode');
    dom.btnReset = document.getElementById('btnReset');
    dom.autoProcessToggle = document.getElementById('autoProcessToggle');

    dom.sourceCodeInput = document.getElementById('sourceCodeInput');
    dom.sourceLineNumbers = document.getElementById('sourceLineNumbers');
    dom.sourceCharCount = document.getElementById('sourceCharCount');
    dom.sourceSizeBadge = document.getElementById('sourceSizeBadge');

    dom.astTreeContainer = document.getElementById('astTreeContainer');
    dom.astJsonContainer = document.getElementById('astJsonContainer');
    dom.astInspectorContainer = document.getElementById('astInspectorContainer');
    dom.astJsonOutput = document.getElementById('astJsonOutput');
    dom.astNodeCount = document.getElementById('astNodeCount');
    dom.astSearchInput = document.getElementById('astSearchInput');
    dom.btnExpandAst = document.getElementById('btnExpandAst');
    dom.btnCollapseAst = document.getElementById('btnCollapseAst');
    dom.inspectorCard = document.getElementById('inspectorCard');

    dom.outputCodeViewer = document.getElementById('outputCodeViewer');
    dom.outputLineNumbers = document.getElementById('outputLineNumbers');
    dom.outputCharCount = document.getElementById('outputCharCount');
    dom.outputSizeBadge = document.getElementById('outputSizeBadge');
    dom.savingsBadge = document.getElementById('savingsBadge');

    dom.btnCopyOutput = document.getElementById('btnCopyOutput');
    dom.btnDownloadMin = document.getElementById('btnDownloadMin');
    dom.btnDownloadAst = document.getElementById('btnDownloadAst');

    dom.valOrigSize = document.getElementById('valOrigSize');
    dom.valMinSize = document.getElementById('valMinSize');
    dom.valSavedBytes = document.getElementById('valSavedBytes');
    dom.valSavingsPct = document.getElementById('valSavingsPct');
    dom.valRatio = document.getElementById('valRatio');
    dom.valGzip = document.getElementById('valGzip');
    dom.parseTimeBadge = document.getElementById('parseTimeBadge');
    dom.meterFill = document.getElementById('meterFill');
    dom.meterMinPct = document.getElementById('meterMinPct');
    dom.meterSavingsPct = document.getElementById('meterSavingsPct');

    dom.toast = document.getElementById('toast');
    dom.toastMessage = document.getElementById('toastMessage');

    // Settings elements
    dom.optStripWhitespace = document.getElementById('optStripWhitespace');
    dom.optStripComments = document.getElementById('optStripComments');
    dom.optRemoveConsole = document.getElementById('optRemoveConsole');
    dom.optConstantFolding = document.getElementById('optConstantFolding');
    dom.optMangleVariables = document.getElementById('optMangleVariables');
    dom.optMangleFunctions = document.getElementById('optMangleFunctions');
    dom.optPreserveGlobals = document.getElementById('optPreserveGlobals');
    dom.optStringEncoding = document.getElementById('optStringEncoding');
    dom.optDeadCode = document.getElementById('optDeadCode');
    dom.optHexNumbers = document.getElementById('optHexNumbers');

    // Load initial source code
    dom.sourceCodeInput.value = state.sourceCode;

    // Real-time Editor Input
    const debouncedRun = debounce(() => {
      if (dom.autoProcessToggle.checked) {
        runAstPipeline();
      }
    }, 250);

    dom.sourceCodeInput.addEventListener('input', () => {
      updateLineNumbers(dom.sourceCodeInput, dom.sourceLineNumbers);
      debouncedRun();
    });

    // Synchronize textarea line number scrolling
    dom.sourceCodeInput.addEventListener('scroll', () => {
      dom.sourceLineNumbers.scrollTop = dom.sourceCodeInput.scrollTop;
    });

    dom.outputCodeViewer.addEventListener('scroll', () => {
      dom.outputLineNumbers.scrollTop = dom.outputCodeViewer.scrollTop;
    });

    // Preset Selection
    dom.samplePresetSelect.addEventListener('change', (e) => {
      const key = e.target.value;
      if (CODE_SAMPLES[key]) {
        dom.sourceCodeInput.value = CODE_SAMPLES[key];
        runAstPipeline();
        showToast(`Loaded ${key.toUpperCase()} Sample Code`);
      }
    });

    // Process Button
    dom.btnProcessCode.addEventListener('click', () => {
      runAstPipeline();
      showToast('AST Transformation Pipeline Complete!');
    });

    // Reset Button
    dom.btnReset.addEventListener('click', () => {
      dom.sourceCodeInput.value = CODE_SAMPLES.algorithm;
      dom.samplePresetSelect.value = 'algorithm';
      runAstPipeline();
      showToast('Reset code to default sample');
    });

    // View Switcher Buttons
    const viewSplitBtn = document.getElementById('viewSplitBtn');
    const viewAstBtn = document.getElementById('viewAstBtn');
    const viewOutputBtn = document.getElementById('viewOutputBtn');
    const studioWorkspace = document.getElementById('studioWorkspace');

    function setWorkspaceLayout(mode) {
      document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
      studioWorkspace.classList.remove('view-ast', 'view-output');

      if (mode === 'ast') {
        viewAstBtn.classList.add('active');
        studioWorkspace.classList.add('view-ast');
      } else if (mode === 'output') {
        viewOutputBtn.classList.add('active');
        studioWorkspace.classList.add('view-output');
      } else {
        viewSplitBtn.classList.add('active');
      }
    }

    viewSplitBtn.addEventListener('click', () => setWorkspaceLayout('split'));
    viewAstBtn.addEventListener('click', () => setWorkspaceLayout('ast'));
    viewOutputBtn.addEventListener('click', () => setWorkspaceLayout('output'));

    // AST Visualizer Tabs
    document.querySelectorAll('.ast-tab').forEach(tabBtn => {
      tabBtn.addEventListener('click', () => {
        document.querySelectorAll('.ast-tab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.ast-tab-content').forEach(c => c.classList.remove('active'));

        tabBtn.classList.add('active');
        const tabKey = tabBtn.getAttribute('data-tab');
        if (tabKey === 'tree') dom.astTreeContainer.classList.add('active');
        else if (tabKey === 'json') dom.astJsonContainer.classList.add('active');
        else if (tabKey === 'inspector') dom.astInspectorContainer.classList.add('active');
      });
    });

    // AST Search Filter
    dom.astSearchInput.addEventListener('input', debounce(() => {
      if (state.ast) {
        renderAstTree(state.ast, dom.astTreeContainer, 0, dom.astSearchInput.value);
      }
    }, 200));

    // Expand & Collapse Buttons
    document.getElementById('btnExpandAst').addEventListener('click', () => {
      document.querySelectorAll('.ast-children.collapsed').forEach(c => c.classList.remove('collapsed'));
      document.querySelectorAll('.ast-toggle.collapsed').forEach(t => t.classList.remove('collapsed'));
    });

    document.getElementById('btnCollapseAst').addEventListener('click', () => {
      document.querySelectorAll('.ast-children').forEach(c => c.classList.add('collapsed'));
      document.querySelectorAll('.ast-toggle').forEach(t => t.classList.add('collapsed'));
    });

    // Settings Event Handlers
    function bindSetting(elem, settingKey, isSelect = false) {
      if (!elem) return;
      elem.addEventListener('change', () => {
        state.settings[settingKey] = isSelect ? elem.value : elem.checked;
        runAstPipeline();
      });
    }

    bindSetting(dom.optStripWhitespace, 'stripWhitespace');
    bindSetting(dom.optStripComments, 'stripComments');
    bindSetting(dom.optRemoveConsole, 'removeConsole');
    bindSetting(dom.optConstantFolding, 'constantFolding');
    bindSetting(dom.optMangleVariables, 'mangleVariables', true);
    bindSetting(dom.optMangleFunctions, 'mangleFunctions');
    bindSetting(dom.optPreserveGlobals, 'preserveGlobals');
    bindSetting(dom.optStringEncoding, 'stringEncoding', true);
    bindSetting(dom.optDeadCode, 'deadCode');
    bindSetting(dom.optHexNumbers, 'hexNumbers');

    // Export Buttons
    dom.btnCopyOutput.addEventListener('click', () => {
      const code = dom.outputCodeViewer.value;
      if (!code) return;
      navigator.clipboard.writeText(code).then(() => {
        showToast('Minified JavaScript copied to clipboard!');
      });
    });

    dom.btnDownloadMin.addEventListener('click', () => {
      const code = dom.outputCodeViewer.value;
      if (!code) return;
      const blob = new Blob([code], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bundle.min.js';
      a.click();
      URL.revokeObjectURL(url);
      showToast('Downloaded bundle.min.js file');
    });

    dom.btnDownloadAst.addEventListener('click', () => {
      if (!state.ast) return;
      const jsonStr = JSON.stringify(state.ast, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ast-schema.json';
      a.click();
      URL.revokeObjectURL(url);
      showToast('Exported AST JSON Schema');
    });

    // Initial Pipeline Run
    runAstPipeline();
  }

  // Launch application on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUI);
  } else {
    initUI();
  }

})();
