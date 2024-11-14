// backend/static/admin/js/admin_dark_mode.js

document.addEventListener("DOMContentLoaded", function () {
  const toggleButton = document.createElement("button");
  toggleButton.textContent = "Toggle Dark Mode";

  // Styling adjustments
  toggleButton.style.position = "fixed";
  toggleButton.style.bottom = "20px"; // Moved to the bottom-right corner
  toggleButton.style.right = "20px";
  toggleButton.style.zIndex = "1000";
  toggleButton.style.padding = "10px 15px";
  toggleButton.style.backgroundColor = "#f0f0f0";
  toggleButton.style.border = "none";
  toggleButton.style.borderRadius = "5px";
  toggleButton.style.cursor = "pointer";
  toggleButton.style.boxShadow = "0 4px 6px rgba(0, 0, 0, 0.1)";

  document.body.appendChild(toggleButton);

  toggleButton.addEventListener("click", function () {
    document.body.classList.toggle("dark-mode");
  });
});
