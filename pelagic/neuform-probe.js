/* Diagnostic: does an external classic script execute in this host? */
(function () {
  var slot = document.getElementById('extern');
  if (slot) { slot.textContent = 'B   external <script src>   RAN'; slot.className = 'row ok'; }
  try {
    var c = document.getElementById('cv'), g = c.getContext('2d');
    g.fillStyle = '#1f5eff'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#fff'; g.font = '600 15px ui-monospace, monospace';
    g.fillText('CANVAS 2D OK', 14, 34);
  } catch (e) {}
})();
