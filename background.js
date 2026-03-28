// Redirects about:home (Firefox homepage) to the custom new tab page
browser.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (tab.url === 'about:home' || tab.url === 'about:newtab') {
    browser.tabs.update(tabId, {
      url: browser.runtime.getURL('newtab.html')
    });
  }
});
