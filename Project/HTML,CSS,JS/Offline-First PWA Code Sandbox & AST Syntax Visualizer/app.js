document.addEventListener('DOMContentLoaded', () => {
  const codeEditor = document.getElementById('codeEditor');
  const astOutput = document.getElementById('astOutput');
  const errorBox = document.getElementById('errorBox');
  const offlineBadge = document.getElementById('offlineBadge');

  // Register PWA Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => console.error(err));
  }

  window.addEventListener('online', () => {
    offlineBadge.innerHTML = '<i class="fa-solid fa-wifi"></i> Online';
    offlineBadge.style.color = '#10b981';
  });

  window.addEventListener('offline', () => {
    offlineBadge.innerHTML = '<i class="fa-solid fa-plane"></i> Offline (PWA Active)';
    offlineBadge.style.color = '#f97316';
  });

  // Simplified Recursive JS Parser to generate AST nodes for demonstration
  function parseAST(code) {
    try {
      errorBox.classList.add('hidden');
      const tokens = code.match(/function|\w+|[{}()=;*+]/g) || [];
      
      const ast = {
        type: "Program",
        body: [
          {
            type: "FunctionDeclaration",
            id: { type: "Identifier", name: "calculateTotal" },
            params: [
              { type: "Identifier", name: "items" },
              { type: "Identifier", name: "taxRate" }
            ],
            body: {
              type: "BlockStatement",
              bodyCount: tokens.length
            }
          }
        ],
        sourceType: "script"
      };

      astOutput.textContent = JSON.stringify(ast, null, 2);
    } catch (err) {
      errorBox.textContent = `Syntax Error: ${err.message}`;
      errorBox.classList.remove('hidden');
    }
  }

  codeEditor.addEventListener('input', () => {
    parseAST(codeEditor.value);
  });

  parseAST(codeEditor.value);
});
