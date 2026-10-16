/* =========================================================
   AORO CARE — Patient My Health
   Positions the BMI marker from its data attribute so the HTML
   has no template code inside style="" attributes.
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {

  document.querySelectorAll("[data-marker]").forEach(function (el) {
    el.style.left = el.getAttribute("data-marker") + "%";
  });

});