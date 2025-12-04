// Force full page reload when clicking logo to load static landing page
document.addEventListener('click', function(e) {
  var target = e.target;
  // Traverse up to find the logo link (max 6 levels)
  for (var i = 0; i < 6 && target && target !== document; i++) {
    // Vocs logo is an anchor with href="/"
    if (target.tagName === 'A' && target.getAttribute('href') === '/') {
      // Check if it's the logo by looking for Vocs logo-related classes
      var parent = target.parentElement;
      var isLogo = false;
      for (var j = 0; j < 4 && parent; j++) {
        var className = parent.className || '';
        // Match Vocs class naming: vocs_NavLogo, vocs_MobileTopNav_logo, vocs_Sidebar, etc.
        if (className.includes('NavLogo') ||
            className.includes('_logo') ||
            className.includes('MobileTopNav') ||
            className.includes('DesktopTopNav') ||
            className.includes('Sidebar')) {
          isLogo = true;
          break;
        }
        parent = parent.parentElement;
      }
      if (isLogo) {
        e.preventDefault();
        e.stopPropagation();
        window.location.href = '/';
        return;
      }
    }
    target = target.parentElement;
  }
}, true);
