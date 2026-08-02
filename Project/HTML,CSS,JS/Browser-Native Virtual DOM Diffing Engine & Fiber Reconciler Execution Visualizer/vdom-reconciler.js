const oldVdom = {
  type: "div",
  props: { className: "card-wrapper", id: "user-card" },
  children: [
    { type: "h2", props: { style: "color: blue" }, children: ["User Profile"] },
    { type: "p", props: { key: "item-1" }, children: ["Alice - Admin"] },
    { type: "p", props: { key: "item-2" }, children: ["Bob - Member"] }
  ]
};

let currentNewVdom = JSON.parse(JSON.stringify(oldVdom));

function renderVdomTrees() {
  document.getElementById("oldVdomCode").textContent = JSON.stringify(oldVdom, null, 2);
  document.getElementById("newVdomCode").textContent = JSON.stringify(currentNewVdom, null, 2);
}

function triggerReconciliation(mode) {
  const diffLogs = document.getElementById("diffLogs");
  diffLogs.innerHTML = "";

  if (mode === "updateProps") {
    currentNewVdom = JSON.parse(JSON.stringify(oldVdom));
    currentNewVdom.children[0].props.style = "color: green";
    
    appendLog("FIBER RECONCILER", "Starting Work Loop on Root Fiber...");
    appendLog("DIFF AT H2", "UPDATE_PROP: style changed from 'color: blue' to 'color: green'");
    appendLog("COMMIT PHASE", "Flushed 1 DOM attribute mutation to Real DOM in 0.4ms.");
  } else if (mode === "reorderList") {
    currentNewVdom = JSON.parse(JSON.stringify(oldVdom));
    const child1 = currentNewVdom.children[1];
    currentNewVdom.children[1] = currentNewVdom.children[2];
    currentNewVdom.children[2] = child1;

    appendLog("FIBER RECONCILER", "Keyed List Reconciliation via Map Lookup...");
    appendLog("DIFF AT KEY item-2", "MOVE_NODE: Reordered key 'item-2' from index 2 to index 1");
    appendLog("COMMIT PHASE", "Executed single insertBefore() DOM node relocation.");
  } else if (mode === "replaceNode") {
    currentNewVdom = JSON.parse(JSON.stringify(oldVdom));
    currentNewVdom.children[0] = { type: "h1", props: { style: "color: red" }, children: ["User Header"] };

    appendLog("FIBER RECONCILER", "Node Type Mismatch (H2 != H1)...");
    appendLog("DIFF AT ROOT CHILD 0", "REPLACE_NODE: Unmounted <h2/> and mounted new <h1/>");
    appendLog("COMMIT PHASE", "Rebuilt subtree for <h1/>.");
  }

  renderVdomTrees();
}

function appendLog(phase, text) {
  const diffLogs = document.getElementById("diffLogs");
  const div = document.createElement("div");
  div.style.marginBottom = "0.4rem";
  div.innerHTML = `<span style="color: #38bdf8">[${phase}]</span> ${text}`;
  diffLogs.appendChild(div);
}

document.addEventListener("DOMContentLoaded", renderVdomTrees);
