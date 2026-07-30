document.addEventListener('DOMContentLoaded', () => {
  const terminalInput = document.getElementById('terminalInput');
  const terminalLog = document.getElementById('terminalLog');
  const graphBox = document.getElementById('graphBox');

  let commits = [{ id: 'C0', branch: 'main' }];
  let activeBranch = 'main';

  function renderGraph() {
    graphBox.innerHTML = '';
    commits.forEach((c, idx) => {
      const node = document.createElement('div');
      node.className = 'commit-node';
      node.innerHTML = `
        ${c.id}
        ${idx === commits.length - 1 ? `<span class="branch-tag">${c.branch} (HEAD)</span>` : ''}
      `;
      graphBox.appendChild(node);
    });
  }

  function log(text) {
    const div = document.createElement('div');
    div.textContent = text;
    terminalLog.appendChild(div);
    terminalLog.scrollTop = terminalLog.scrollHeight;
  }

  terminalInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const cmd = terminalInput.value.trim();
      log(`$ ${cmd}`);
      terminalInput.value = '';

      if (cmd.startsWith('git commit')) {
        const nextId = `C${commits.length}`;
        commits.push({ id: nextId, branch: activeBranch });
        log(`[${activeBranch} ${nextId}] Created new commit in DAG tree.`);
        renderGraph();
      } else if (cmd.startsWith('git branch')) {
        const branchName = cmd.split(' ')[2] || 'feature';
        log(`Created new branch '${branchName}'.`);
      } else if (cmd.startsWith('git checkout')) {
        const branchName = cmd.split(' ')[2] || 'main';
        activeBranch = branchName;
        log(`Switched to branch '${branchName}'.`);
        renderGraph();
      } else if (cmd.startsWith('git merge')) {
        log(`Fast-forward merge completed onto ${activeBranch}.`);
      } else {
        log(`Unknown command. Try: git commit, git branch <name>, git checkout <name>`);
      }
    }
  });

  renderGraph();
});
