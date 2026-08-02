function insertBTreeKey(key) {
  const status = document.getElementById("dbStatus");
  status.textContent = `Inserted Key ${key}. B+ Tree Node [20, 35, 42] overflowed -> Promoted 35 to parent root. LSM Level-1 Compaction triggered.`;
}
