/* landing-ui.js
   - Renders operator help content into the landing area
   - Keeps help text concise and keyboard shortcuts visible
*/
(function () {
  function getHelpHtml() {
    return "<h2>Live Scoreboard - Operator Help</h2>" +
      "<p>Use this page to create and control a live match. Once created, the controller view will appear.</p>" +
      "<h3>Keyboard Shortcuts</h3>" +
      "<ul>" +
      "<li><strong>Space</strong>: Toggle timer (start/pause)</li>" +
      "<li><strong>G</strong>: Add goal (home)</li>" +
      "<li><strong>H</strong>: Add goal (away)</li>" +
      "<li><strong>Z</strong>: Undo last goal</li>" +
      "</ul>" +
      "<h3>Notes</h3>" +
      "<ul>" +
      "<li>The controller is the single source of truth; do not open multiple controllers during a match unless intentionally recovering state.</li>" +
      "<li>Display screens are read-only and will automatically update.</li>" +
      "</ul>";
  }

  function render() {
    const container = document.querySelector('[data-area="help"]');
    if (!container) return;
    container.innerHTML = getHelpHtml();
  }

  document.addEventListener('DOMContentLoaded', render);
})();
