// Types out every <blockquote> on the page, once, the first time it scrolls into view.
// Shared site-wide (not per-include) since it applies generically to any blockquote —
// including ones in future _posts/*.md content — not just the Gratitude quote it was
// built for. See the "Interaction Rules" exception noted in .ai/architecture.md.
(function () {
  var TYPE_SPEED_MS = 35;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Recursively clones a node's children, keeping element structure (e.g. <br>, <small>)
  // intact but emptying every text node, so the quote's markup is correct from frame one
  // and only the characters themselves get revealed over time.
  function buildEmptyClone(sourceNode) {
    var queue = [];

    function walk(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        var empty = document.createTextNode('');
        queue.push({ node: empty, text: node.textContent });
        return empty;
      }
      var clone = node.cloneNode(false);
      node.childNodes.forEach(function (child) {
        clone.appendChild(walk(child));
      });
      return clone;
    }

    var fragment = document.createDocumentFragment();
    sourceNode.childNodes.forEach(function (child) {
      fragment.appendChild(walk(child));
    });
    return { fragment: fragment, queue: queue };
  }

  function typeQuote(blockquote) {
    var built = buildEmptyClone(blockquote);
    blockquote.innerHTML = '';
    blockquote.appendChild(built.fragment);

    var cursor = document.createElement('span');
    cursor.className = 'typing-cursor';
    blockquote.appendChild(cursor);

    var queue = built.queue;
    var qi = 0;
    var ci = 0;

    function tick() {
      if (qi >= queue.length) {
        cursor.remove();
        return;
      }
      var entry = queue[qi];
      if (ci < entry.text.length) {
        entry.node.textContent += entry.text.charAt(ci);
        ci++;
        setTimeout(tick, TYPE_SPEED_MS);
      } else {
        qi++;
        ci = 0;
        tick();
      }
    }

    tick();
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (reduceMotion || typeof IntersectionObserver === 'undefined') return;

    var quotes = document.querySelectorAll('blockquote');
    if (!quotes.length) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          observer.unobserve(entry.target);
          typeQuote(entry.target);
        }
      });
    }, { threshold: 0.3 });

    quotes.forEach(function (bq) {
      observer.observe(bq);
    });
  });
})();
