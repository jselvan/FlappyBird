// Fetch and display leaderboard
async function loadLeaderboard(section = "") {
  let url = "api/leaderboard";
  if (section.trim() !== "") {
    url += "?section=" + encodeURIComponent(section.trim());
  }

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch leaderboard");
    const scores = await res.json();

    const list = document.getElementById("leaders");
    list.innerHTML = "";

    if (scores.length === 0) {
      const li = document.createElement("li");
      li.textContent = "No scores found.";
      list.appendChild(li);
      return;
    }

    scores.forEach(s => {
      const li = document.createElement("li");
      li.textContent = `${s.name} - ${s.score} pts (Section: ${s.section || "N/A"})`;
      list.appendChild(li);
    });
  } catch (err) {
    console.error("Error loading leaderboard:", err);
    const list = document.getElementById("leaders");
    list.innerHTML = "<li>Error loading leaderboard</li>";
  }
}

// Initial load (no filter)
document.addEventListener("DOMContentLoaded", () => {
  loadLeaderboard();

  // Hook up the filter button
  document.getElementById("apply-filter").addEventListener("click", () => {
    const section = document.getElementById("section-filter").value;
    loadLeaderboard(section);
  });
});
