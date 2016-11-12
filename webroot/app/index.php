<!DOCTYPE html>
<!-- This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/. -->
<?php include_once($_SERVER['DOCUMENT_ROOT'] . '/components/output-link-elements.inc.php'); ?>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, user-scalable=false">
    <meta name="application-name" content="BzDeck">
    <meta name="description" content="A useful, experimental Bugzilla client demonstrating modern Web application technologies such as CSS3, DOM4, HTML5, ECMAScript 6 and WAI-ARIA.">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="BzDeck">
    <meta property="og:locale" content="en_US">
    <meta property="og:url" content="https://www.bzdeck.com/">
    <meta property="og:image" content="https://www.bzdeck.com/static/images/logo/icon-512.png">
    <meta property="og:title" content="BzDeck">
    <meta property="og:description" content="A useful, experimental Bugzilla client demonstrating modern Web application technologies such as CSS3, DOM4, HTML5, ECMAScript 6 and WAI-ARIA.">
    <meta property="fb:admins" content="100003919776216">
    <meta property="fb:page_id" content="240285432763840">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:site" content="@BzDeck">
    <meta name="twitter:domain" content="BzDeck.com">
    <meta name="twitter:url" content="https://www.bzdeck.com/">
    <meta name="msapplication-TileColor" content="#444444">
    <meta name="msapplication-TileImage" content="/static/images/logo/tile.png">
    <link rel="canonical" href="https://www.bzdeck.com/">
    <link rel="publisher" href="https://plus.google.com/+BzDeck">
<?php output_link_elements('css') ?>
    <link rel="stylesheet" type="text/css" media="screen" href="/static/styles/themes/light.css" title="Light">
    <link rel="alternate stylesheet" type="text/css" media="screen" href="/static/styles/themes/dark.css" title="Dark">
    <title>BzDeck</title>
    <template id="tabpanel-search-template">
      <div id="tabpanel-search-TID" tabindex="0" role="tabpanel" aria-labelledby="tab-search-TID">
        <section>
          <header>
            <h2>Search &amp; Browse Bugs</h2>
          </header>
          <div>
            <div id="search-TID-basic-search-pane" role="search">
              <div class="browse-box">
                <section id="search-TID-browse-classification">
                  <h3>Classification</h3>
                  <div id="search-TID-browse-classification-list-outer">
                    <menu id="search-TID-browse-classification-list" type="list" tabindex="0" role="listbox" aria-multiselectable="true"></menu>
                  </div>
                </section>
                <section id="search-TID-browse-product">
                  <h3>Product</h3>
                  <div id="search-TID-browse-product-list-outer">
                    <menu id="search-TID-browse-product-list" type="list" tabindex="0" role="listbox" aria-multiselectable="true"></menu>
                  </div>
                </section>
                <section id="search-TID-browse-component">
                  <h3>Component</h3>
                  <div id="search-TID-browse-component-list-outer">
                    <menu id="search-TID-browse-component-list" type="list" tabindex="0" role="listbox" aria-multiselectable="true"></menu>
                  </div>
                </section>
                <section id="search-TID-browse-status">
                  <h3>Status</h3>
                  <div id="search-TID-browse-status-list-outer">
                    <menu id="search-TID-browse-status-list" type="list" tabindex="0" role="listbox" aria-multiselectable="true"></menu>
                  </div>
                </section>
                <section id="search-TID-browse-resolution">
                  <h3>Resolution</h3>
                  <div id="search-TID-browse-resolution-list-outer">
                    <menu id="search-TID-browse-resolution-list" type="list" tabindex="0" role="listbox" aria-multiselectable="true"></menu>
                  </div>
                </section>
              </div><!-- end .browse-box -->
              <div class="text-box">
                <section>
                  <h3>Search Terms</h3>
                  <dl>
                    <dt>Summary</dt>
                    <dd><input type="search" role="searchbox"></dd>
                    <dd><span role="button">Search</span></dd>
                  </dl>
                </section>
              </div><!-- end .text-box -->
            </div><!-- end #search-TID-basic-search-pane -->
            <div id="search-TID-result-pane">
              <section id="search-TID-result" class="bug-list" role="grid" aria-multiselectable="true" aria-readonly="true" data-selection="rows"></section>
              <div role="status" aria-hidden="true"><span></span></div>
            </div><!-- end #search-TID-result-pane -->
            <div id="search-TID-preview-pane" aria-hidden="true"></div>
            <div id="search-TID-advanced-search-pane" aria-hidden="true"></div>
          </div>
        </section>
      </div><!-- end #tabpanel-search-TID -->
    </template><!-- end #tabpanel-search-template -->
    <template id="tabpanel-details-template">
      <div id="tabpanel-details-TID" class="bug-container" tabindex="0" role="tabpanel" aria-labelledby="tab-details-TID">
      </div><!-- end #tabpanel-details-TID -->
    </template><!-- end #tabpanel-details-template -->
    <template id="tabpanel-attachment-template">
      <div id="tabpanel-attachment-TID" tabindex="0" role="tabpanel" aria-labelledby="tab-attachment-TID">
        <article id="attachment-TID" role="article">
          <header>
            <h2>Attachment <span itemprop="id"></span></h2>
          </header>
          <div class="scrollable"></div>
        </article>
      </div><!-- end #tabpanel-attachment-TID -->
    </template><!-- end #tabpanel-attachment-template -->
    <template id="tabpanel-settings-template">
      <div id="tabpanel-settings" tabindex="0" role="tabpanel" aria-labelledby="tab-settings">
        <section>
          <header>
            <h2>Settings</h2>
          </header>
          <div>
            <ul id="settings-tablist" tabindex="0" role="tablist" aria-level="2" aria-orientation="vertical" data-removable="false" data-reorderable="false">
              <li id="settings-tab-account" role="tab" aria-controls="settings-tabpanel-account" aria-selected="true"><label>Account</label></li>
              <li id="settings-tab-design" role="tab" aria-controls="settings-tabpanel-design" aria-selected="false"><label>Design</label></li>
              <li id="settings-tab-datetime" role="tab" aria-controls="settings-tabpanel-datetime" aria-selected="false"><label>Date &amp; Time</label></li>
              <li id="settings-tab-notifications" role="tab" aria-controls="settings-tabpanel-notifications" aria-selected="false"><label>Notifications</label></li>
              <li id="settings-tab-timeline" role="tab" aria-controls="settings-tabpanel-timeline" aria-selected="false"><label>Timeline</label></li>
              <li id="settings-tab-editing" role="tab" aria-controls="settings-tabpanel-editing" aria-selected="false"><label>Editing</label></li>
            </ul><!-- end #settings-tablist -->
            <div id="settings-tabpanel-account" tabindex="0" role="tabpanel" aria-hidden="false" aria-labelledby="settings-tab-account">
              <section>
                <h3>Account</h3>
                <section id="settings-qrcode-outer">
                  <h4>BzDeck on mobile</h4>
                  <p>Do you know BzDeck works with Android? Open the app with Firefox on your Android phone or tablet, and scan this QR code to sign in quickly:<br><span role="button">Show QR Code</span></p>
                  <div class="placeholder" hidden></div>
                </section>
              </section>
            </div><!-- end #settings-tabpanel-account -->
            <div id="settings-tabpanel-design" tabindex="0" role="tabpanel" aria-hidden="true" aria-labelledby="settings-tab-design">
              <section>
                <h3>Design</h3>
                <section>
                  <h4>Theme</h4>
                  <ul role="radiogroup" data-pref="ui.theme.selected">
                    <li role="none"><span role="radio" data-value="Light">Light</span></li>
                    <li role="none"><span role="radio" data-value="Dark">Dark</span></li>
                  </ul>
                </section>
                <section data-platform="desktop">
                  <h4>Desktop Layout</h4>
                  <ul role="radiogroup" data-pref="ui.home.layout">
                    <li role="none"><span role="radio" data-value="vertical">Vertical View</span></li>
                    <li role="none"><span role="radio" data-value="classic">Classic View</span></li>
                  </ul>
                </section>
              </section>
            </div><!-- end #settings-tabpanel-design -->
            <div id="settings-tabpanel-datetime" tabindex="0" role="tabpanel" aria-hidden="true" aria-labelledby="settings-tab-datetime">
              <section>
                <h3>Date &amp; Time</h3>
                <section>
                  <h4>Timezone</h4>
                  <ul role="radiogroup" data-pref="ui.date.timezone">
                    <li role="none"><span role="radio" data-value="local" id="pref-timezone-local">Your local timezone</span></li>
                    <li role="none"><span role="radio" data-value="UTC" id="pref-timezone-host">Bugzilla default</span></li>
                    <li role="none"><span role="radio" data-value="UTC">UTC</span></li>
                  </ul>
                </section>
                <section>
                  <h4>Date Format</h4>
                  <ul role="none">
                    <li role="none"><span role="checkbox" data-pref="ui.date.relative">Use relative date</span></li>
                  </ul>
                </section>
              </section>
            </div><!-- end #settings-tabpanel-datetime -->
            <div id="settings-tabpanel-notifications" tabindex="0" role="tabpanel" aria-hidden="true" aria-labelledby="settings-tab-notifications">
              <section>
                <h3>Notifications</h3>
                <section>
                  <h4>General</h4>
                  <ul role="none">
                    <li role="none"><span role="checkbox" data-pref="notifications.show_desktop_notifications">Show desktop notifications if possible</span></li>
                    <li role="none"><span role="checkbox" data-pref="notifications.ignore_cc_changes">Ignore CC changes</span></li>
                  </ul>
                </section>
              </section>
            </div><!-- end #settings-tabpanel-notifications -->
            <div id="settings-tabpanel-timeline" tabindex="0" role="tabpanel" aria-hidden="true" aria-labelledby="settings-tab-timeline">
              <section>
                <h3>Timeline</h3>
                <section>
                  <h4>Sort Order</h4>
                  <ul role="radiogroup" data-pref="ui.timeline.sort.order">
                    <li role="none"><span role="radio" data-value="ascending">Ascending (old to new)</span></li>
                    <li role="none"><span role="radio" data-value="descending">Descending (new to old)</span></li>
                  </ul>
                </section>
                <section>
                  <h4>Font Family</h4>
                  <ul role="radiogroup" data-pref="ui.timeline.font.family">
                    <li role="none"><span role="radio" data-value="proportional">Proportional</span></li>
                    <li role="none"><span role="radio" data-value="monospace">Monospace</span></li>
                  </ul>
                </section>
                <section>
                  <h4>CC Changes</h4>
                  <ul role="none">
                    <li role="none"><span role="checkbox" data-pref="ui.timeline.show_cc_changes">Show CC changes</span></li>
                  </ul>
                </section>
                <section>
                  <h4>Show Media Attachments</h4>
                  <ul role="radiogroup" data-pref="ui.timeline.show_attachments">
                    <li role="none"><span role="radio" data-value="2">Always</span></li>
                    <li role="none"><span role="radio" data-value="1">Only over Wi-Fi</span></li>
                    <li role="none"><span role="radio" data-value="0">Never</span></li>
                  </ul>
                </section>
              </section>
            </div><!-- end #settings-tabpanel-timeline -->
            <div id="settings-tabpanel-editing" tabindex="0" role="tabpanel" aria-hidden="true" aria-labelledby="settings-tab-editing">
              <section>
                <h3>Editing</h3>
                <section>
                  <h4>Navigation</h4>
                  <ul>
                    <li role="none"><span role="checkbox" data-pref="editing.move_next_once_submitted">Move to the next bug after saving changes</span></li>
                  </ul>
                </section>
              </section>
            </div><!-- end #settings-tabpanel-editing -->
          </div>
          <footer>
          </footer>
        </section>
      </div><!-- end #tabpanel-settings -->
    </template><!-- end #tabpanel-settings-template -->
    <template id="tabpanel-profile-template">
      <div id="tabpanel-profile" tabindex="0" role="tabpanel" aria-labelledby="tab-profile">
        <section>
          <header>
            <h2>Profile</h2>
          </header>
          <div>
            <article id="profile-TID" role="article" itemscope itemtype="http://bzdeck.com/User">
              <header>
                <div>
                  <img alt="" itemprop="image">
                  <h3 itemprop="name"></h3>
                </div>
              </header>
              <dl>
                <dt>ID</dt>
                <dd><span itemprop="id"></span></dd>
                <dt>Email</dt>
                <dd><a itemprop="emailLink"><span itemprop="email"></span></a></dd>
              </dl>
              <ul>
                <li data-id="bugzilla-profile"><a href="">User Profile on Bugzilla</a></li>
                <li data-id="bugzilla-activity"><a href="">User Activity on Bugzilla</a></li>
                <li data-id="gravatar-avatar"><a href="https://en.gravatar.com/emails/">Change your avatar image</a></li>
                <li data-id="gravatar-background"><a href="https://en.gravatar.com/profiles/edit/#custom-background">Change your background image</a></li>
              </ul>
              <p>This User Profile panel is under development. More information will be added in the future.</p>
            </article><!-- end #profile-TID -->
          </div>
          <footer>
            <div role="status"></div>
          </footer>
        </section>
      </div><!-- end #tabpanel-profile -->
    </template><!-- end #tabpanel-profile-template -->
    <template id="search-preview-bug-template">
      <article id="search-TID-preview-bug" role="article" aria-hidden="true" itemscope itemtype="http://bzdeck.com/Bug">
        <header>
          <h3>Bug <span itemprop="id"></span></h3>
          <div role="toolbar">
            <ul role="none">
              <li role="none"><span class="iconic" title="Star this bug" tabindex="0" role="button" aria-pressed="false" data-command="star" data-field="starred">Star</span></li>
              <li role="none"><span class="iconic" title="Menu" tabindex="0" role="button" aria-pressed="false" aria-haspopup="true" aria-owns="search-TID-preview-bug-menu" data-command="show-menu">Menu</span></li>
              <li role="none"><span class="iconic" title="Open this bug in a new tab" tabindex="0" role="button" data-command="open-tab">Open in Tab</span></li>
            </ul>
            <ul role="none">
              <li role="none"><span class="iconic" title="Show the query pane to search again" tabindex="0" role="button" data-command="show-basic-search-pane">Search Again</span></li>
            </ul>
            <ul id="search-TID-preview-bug-menu" role="menu" aria-expanded="false">
              <li role="none">
                <a id="search-TID-preview-bug-menu-toggle-comments" role="menuitem"><label>Expand All Comments</label></a>
                <a id="search-TID-preview-bug-menu-toggle-cc" role="menuitem"><label>Show CC Changes</label></a>
              </li>
              <li role="separator"></li>
              <li role="none">
                <a id="search-TID-preview-bug-menu-copy-link" role="menuitem" data-command="copy-link"><label>Copy Link</label></a>
                <a id="search-TID-preview-bug-menu-open-bugzilla" role="menuitem" data-command="open-bugzilla"><label>Open in Bugzilla</label></a>
                <a id="search-TID-preview-bug-menu-tweet" role="menuitem" data-command="tweet"><label>Tweet</label></a>
              </li>
            </ul><!-- end #search-TID-preview-bug-menu -->
          </div><!-- end [role="toolbar"] -->
        </header>
        <div id="search-TID-preview-bug-timeline-wrapper" class="bug-timeline-wrapper">
          <div class="bug-timeline" tabindex="0" role="region" aria-live="true" aria-relevant="additions">
            <h3 class="bug-summary" itemprop="summary"></h3>
            <div role="feed" class="comments-wrapper"></div>
          </div>
        </div><!-- end #search-TID-preview-bug-timeline-wrapper -->
        <div class="att-drop-target" aria-dropeffect="none"><div><label>Drop text or files here to attach</label></div></div>
      </article><!-- end #search-TID-preview-bug -->
    </template><!-- end #search-preview-bug-template -->
    <template id="bug-details-template">
      <article id="bug-TID" role="form" itemscope itemtype="http://bzdeck.com/Bug">
        <header>
          <h2>Bug <span itemprop="id"></span></h2>
          <div role="toolbar">
            <ul class="nav" role="none">
              <li role="none"><span class="iconic" title="Show the previous bug" tabindex="0" role="button" aria-disabled="true" data-command="nav-back">Back</span></li>
              <li role="none"><span class="iconic" title="Show the next bug" tabindex="0" role="button" aria-disabled="true" data-command="nav-forward">Forward</span></li>
            </ul>
            <ul role="none">
              <li role="none"><span class="iconic" title="Star" tabindex="0" role="button" aria-pressed="false" aria-label="Star this bug" data-command="star" data-field="starred">Star</span></li>
              <li role="none"><span class="iconic" title="Edit" tabindex="0" role="button" aria-pressed="false" aria-label="Edit the fields of this bug" data-command="edit"></span>
              <li role="none"><span class="iconic" title="Menu" tabindex="0" role="button" aria-pressed="false" aria-label="Show the menu items for this bug" aria-haspopup="true" aria-owns="bug-TID-menu" data-command="show-menu">Menu</span></li>
            </ul>
            <ul id="bug-TID-menu" role="menu" aria-expanded="false">
              <li role="none">
                <a id="bug-TID-preview-bug-menu-toggle-comments" role="menuitem"><label>Expand All Comments</label></a>
                <a id="bug-TID-preview-bug-menu-toggle-cc" role="menuitem"><label>Show CC Changes</label></a>
              </li>
              <li role="separator"></li>
              <li role="none">
                <a id="bug-TID-menu-open-tab" role="menuitem" data-command="open-tab"><label>Open in Tab</label></a>
                <a id="bug-TID-menu-open-bugzilla" role="menuitem" data-command="open-bugzilla"><label>Open in Bugzilla</label></a>
                <a id="bug-TID-menu-copy-link" role="menuitem" data-command="copy-link"><label>Copy Link</label></a>
                <a id="bug-TID-menu-tweet" role="menuitem" data-command="tweet"><label>Tweet</label></a>
              </li>
            </ul>
          </div><!-- end [role="toolbar"] -->
        </header>
        <div>
          <ul id="bug-TID-tablist" tabindex="0" role="tablist" aria-level="2" data-removable="false" data-reorderable="false">
            <li id="bug-TID-tab-timeline" role="tab" aria-controls="bug-TID-tabpanel-timeline" aria-selected="true"><label>Timeline</label></li>
            <li id="bug-TID-tab-info" role="tab" aria-controls="bug-TID-tabpanel-info" aria-selected="false"><label>Info</label></li>
            <li id="bug-TID-tab-participants" role="tab" aria-controls="bug-TID-tabpanel-participants" aria-selected="false"><label>Participants</label></li>
            <li id="bug-TID-tab-attachments" role="tab" aria-controls="bug-TID-tabpanel-attachments" aria-selected="false"><label>Attachments</label></li>
            <li id="bug-TID-tab-history" role="tab" aria-controls="bug-TID-tabpanel-history" aria-disabled="true" aria-selected="false"><label>History</label></li>
          </ul><!-- end #bug-TID-tablist -->
          <div id="bug-TID-tabpanels">
            <div id="bug-TID-tabpanel-timeline" tabindex="0" role="tabpanel" aria-hidden="false" aria-labelledby="bug-TID-tab-timeline">
              <div class="bug-timeline-wrapper">
                <div class="bug-timeline scrollable" tabindex="0" role="article" aria-live="true" aria-relevant="additions">
                  <section>
                    <header class="bug-summary" data-field="summary">
                      <h3><span class="distinct" contenteditable="true" role="textbox" itemprop="summary" aria-label="Summary" aria-required="true"></span></h3>
                    </header>
                    <div role="feed" class="comments-wrapper"></div>
                  </section>
                </div>
              </div>
            </div><!-- end #bug-TID-tabpanel-timeline -->
            <div id="bug-TID-tabpanel-info" tabindex="0" role="tabpanel" aria-hidden="true" aria-labelledby="bug-TID-tab-info">
              <div id="bug-TID-info" class="bug-info scrollable" tabindex="0" role="region">
                <section role="group" class="bug-fieldset" aria-label="Status Fieldset" data-category="status">
                  <header>
                    <h3>Status</h3>
                  </header>
                  <section role="group" aria-label="Filed" data-field="creation_time">
                    <h4>Filed</h4>
                    <time itemprop="creation_time" data-relative="false"></time>
                  </section>
                  <section role="group" aria-label="Last Modified" data-field="last_change_time">
                    <h4>Modified</h4>
                    <time itemprop="last_change_time" data-relative="false"></time>
                  </section>
                  <section role="group" aria-label="Status" data-field="status">
                    <h4>Status</h4>
                    <span class="distinct" role="combobox" aria-label="Status" aria-autocomplete="list" aria-readonly="true">
                      <span role="searchbox" aria-readonly="true" tabindex="0" itemprop="status"></span>
                    </span>
                  </section>
                  <section hidden role="group" aria-label="Resolution" data-field="resolution">
                    <h4>Resolution</h4>
                    <span class="distinct" role="combobox" aria-label="Resolution" aria-autocomplete="list" aria-readonly="true">
                      <span role="searchbox" aria-readonly="true" tabindex="0" itemprop="resolution"></span>
                    </span>
                  </section>
                  <section hidden role="group" aria-label="Duplicate of" data-field="dupe_of">
                    <h4>Duplicate of</h4>
                    <span class="distinct" contenteditable="true" role="textbox" aria-label="Duplicate of" aria-disabled="true" itemprop="dupe_of"></span>
                  </section>
                  <section role="group" aria-label="Target Milestone" data-field="target_milestone">
                    <h4>Milestone</h4>
                    <span class="distinct" role="combobox" aria-label="Target Milestone" aria-autocomplete="list" aria-readonly="true">
                      <span role="searchbox" aria-readonly="true" tabindex="0" itemprop="target_milestone"></span>
                    </span>
                  </section>
                  <section role="group" aria-label="Severity" data-field="severity">
                    <h4>Severity</h4>
                    <span class="distinct" role="combobox" aria-label="Severity" aria-autocomplete="list" aria-readonly="true">
                      <span role="searchbox" aria-readonly="true" tabindex="0" itemprop="severity"></span>
                    </span>
                  </section>
                  <section role="group" aria-label="Priority" data-field="priority">
                    <h4>Priority</h4>
                    <span class="distinct" role="combobox" aria-label="Priority" aria-autocomplete="list" aria-readonly="true">
                      <span role="searchbox" aria-readonly="true" tabindex="0" itemprop="priority"></span>
                    </span>
                  </section>
                </section>
                <section role="group" class="bug-fieldset" aria-label="Affected Fieldset" data-category="affected">
                  <header>
                    <h3>Affected</h3>
                  </header>
                  <section role="group" aria-label="Product" data-field="product">
                    <h4>Product</h4>
                    <span class="distinct" role="combobox" aria-label="Product" aria-autocomplete="list" aria-readonly="true">
                      <span role="searchbox" aria-readonly="true" tabindex="0" itemprop="product"></span>
                    </span>
                  </section>
                  <section role="group" aria-label="Component" data-field="component">
                    <h4>Component</h4>
                    <span class="distinct" role="combobox" aria-label="Component" aria-autocomplete="list" aria-readonly="true">
                      <span role="searchbox" aria-readonly="true" tabindex="0" itemprop="component"></span>
                    </span>
                  </section>
                  <section role="group" aria-label="Version" data-field="version">
                    <h4>Version</h4>
                    <span class="distinct" role="combobox" aria-label="Version" aria-autocomplete="list" aria-readonly="true">
                      <span role="searchbox" aria-readonly="true" tabindex="0" itemprop="version"></span>
                    </span>
                  </section>
                  <section role="group" aria-label="Hardware" data-field="platform">
                    <h4>Hardware</h4>
                    <span class="distinct" role="combobox" aria-label="Hardware" aria-autocomplete="list" aria-readonly="true">
                      <span role="searchbox" aria-readonly="true" tabindex="0" itemprop="platform"></span>
                    </span>
                  </section>
                  <section role="group" aria-label="OS" data-field="op_sys">
                    <h4>OS</h4>
                    <span class="distinct" role="combobox" aria-label="OS" aria-autocomplete="list" aria-readonly="true">
                      <span role="searchbox" aria-readonly="true" tabindex="0" itemprop="op_sys"></span>
                    </span>
                  </section>
                </section>
                <section role="group" class="bug-fieldset" aria-label="Notes Fieldset" data-category="notes">
                  <header>
                    <h3>Notes</h3>
                  </header>
                  <section role="group" aria-label="Aliases" data-field="alias">
                    <h4>Aliases</h4>
                    <ul><li itemprop="alias" role="button"></li></ul>
                  </section>
                  <section role="group" aria-label="Keywords" data-field="keyword">
                    <h4>Keywords</h4>
                    <ul><li itemprop="keyword" role="button"></li></ul>
                  </section>
                  <section role="group" aria-label="Whiteboard" data-field="whiteboard">
                    <h4>Whiteboard</h4>
                    <span class="distinct" contenteditable="true" role="textbox" itemprop="whiteboard"></span>
                  </section>
                  <section role="group" aria-label="URL" data-field="url">
                    <h4>URL</h4>
                    <a role="link" itemprop="url"></a>
                  </section>
                  <section role="group" aria-label="See Also" data-field="see_also">
                    <h4>See Also</h4>
                    <ul><li><a role="link" itemprop="see_also"></a></li></ul>
                  </section>
                  <!-- Other custom fields: cf_crash_signature, cf_qa_whiteboard, etc. -->
                </section>
                <section role="group" class="bug-fieldset" aria-label="Dependencies Fieldset" data-category="dependencies">
                  <header>
                    <h3>Dependencies</h3>
                  </header>
                  <section role="group" aria-label="Depends on" data-field="depends_on">
                    <header>
                      <h4>Depends on</h4>
                    </header>
                    <ul class="list">
                      <li role="button" itemprop="depends_on"></li>
                    </ul>
                  </section>
                  <section role="group" aria-label="Blocks" data-field="blocks">
                    <header>
                      <h4>Blocks</h4>
                    </header>
                    <ul class="list">
                      <li role="button" itemprop="blocks"></li>
                    </ul>
                  </section>
                  <section role="group" aria-label="Duplicates" data-field="duplicate">
                    <h4>Duplicates</h4>
                    <ul><li role="button" itemprop="duplicate"></li></ul>
                  </section>
                </section>
                <section role="group" class="bug-fieldset" aria-label="Flags Fieldset" data-category="flags">
                  <header>
                    <h3>Flags</h3>
                  </header>
                </section>
                <section role="group" class="bug-fieldset" aria-label="Tracking Flags Fieldset" data-category="tracking-flags">
                  <header>
                    <h3>Tracking Flags</h3>
                  </header>
                </section>
              </div><!-- end .bug-info -->
            </div><!-- end #bug-TID-tabpanel-info -->
            <div id="bug-TID-tabpanel-participants" tabindex="0" role="tabpanel" aria-hidden="true" aria-labelledby="bug-TID-tab-participants">
              <div id="bug-TID-participants" class="bug-participants scrollable" tabindex="0" role="region">
                <section role="group" class="bug-fieldset" aria-label="Participants Fieldset" data-category="participants">
                  <header>
                    <h3>Participants</h3>
                  </header>
                  <section role="group" aria-label="Reporter" data-field="creator">
                    <header>
                      <h4>Reporter</h4>
                    </header>
                    <ul class="list">
                      <li tabindex="0" role="link" itemprop="creator" itemscope itemtype="http://bzdeck.com/User">
                        <meta itemprop="email">
                        <meta itemprop="description">
                        <img alt="" itemprop="image">
                        <span itemprop="name"></span>
                      </li>
                    </ul>
                  </section>
                  <section role="group" aria-label="Assignee" data-field="assigned_to">
                    <header>
                      <h4>Assignee</h4>
                    </header>
                    <ul class="list">
                      <li tabindex="0" role="link" itemprop="assigned_to" itemscope itemtype="http://bzdeck.com/User">
                        <meta itemprop="email">
                        <meta itemprop="description">
                        <img alt="" itemprop="image">
                        <span itemprop="name"></span>
                      </li>
                    </ul>
                  </section>
                  <section role="group" aria-label="QA" data-field="qa_contact">
                    <header>
                      <h4>QA</h4>
                    </header>
                    <ul class="list">
                      <li tabindex="0" role="link" itemprop="qa_contact" itemscope itemtype="http://bzdeck.com/User">
                        <meta itemprop="email">
                        <meta itemprop="description">
                        <img alt="" itemprop="image">
                        <span itemprop="name"></span>
                      </li>
                    </ul>
                  </section>
                  <section role="group" aria-label="Mentors" data-field="mentor">
                    <header>
                      <h4>Mentors</h4>
                    </header>
                    <ul class="list">
                      <li tabindex="0" role="link" itemprop="mentor" itemscope itemtype="http://bzdeck.com/User">
                        <meta itemprop="email">
                        <meta itemprop="description">
                        <img alt="" itemprop="image">
                        <span itemprop="name"></span>
                      </li>
                    </ul>
                  </section>
                  <section role="group" aria-label="Cc" data-field="cc">
                    <header>
                      <h4>Cc</h4>
                    </header>
                    <ul class="list">
                      <li tabindex="0" role="link" itemprop="cc" itemscope itemtype="http://bzdeck.com/User">
                        <meta itemprop="email">
                        <meta itemprop="description">
                        <img alt="" itemprop="image">
                        <span itemprop="name"></span>
                      </li>
                    </ul>
                  </section>
                  <section role="group" aria-label="Other Contributors" data-field="contributor">
                    <header>
                      <h4>Other Contributors</h4>
                    </header>
                    <ul class="list">
                      <li tabindex="0" role="link" itemprop="contributor" itemscope itemtype="http://bzdeck.com/User">
                        <meta itemprop="email">
                        <meta itemprop="description">
                        <img alt="" itemprop="image">
                        <span itemprop="name"></span>
                      </li>
                    </ul>
                  </section>
                </section>
              </div><!-- end .bug-participants -->
            </div><!-- end #bug-TID-tabpanel-participants -->
            <div id="bug-TID-tabpanel-attachments" tabindex="0" role="tabpanel" aria-hidden="true" aria-labelledby="bug-TID-tab-attachments">
              <div class="bug-attachments" tabindex="0">
                <section role="group" aria-label="Attachments" data-field="attachments">
                  <h3>Attachments</h3>
                  <div class="list">
                    <header>
                      <h4>0 Attachments</h4>
                      <meta tabindex="0" role="checkbox" aria-label="Show Obsolete" aria-checked="false" aria-hidden="true">
                    </header>
                    <div class="scrollable" aria-dropeffect="none">
                      <ul tabindex="0" role="listbox" aria-live="true" aria-relevant="additions removals"></ul>
                    </div>
                    <div role="toolbar">
                      <ul role="none">
                        <li role="none"><span class="iconic" title="Add attachments..." tabindex="0" role="button" data-command="add-attachment"></span></li>
                        <li role="none"><span class="iconic" title="Remove an attachment" tabindex="0" role="button" aria-disabled="true" data-command="remove-attachment"></span></li>
                      </ul>
                      <input type="file" hidden multiple directory>
                    </div>
                  </div>
                  <div class="content scrollable" role="region">
                  </div>
                </section>
              </div>
            </div><!-- end #bug-TID-tabpanel-attachments -->
            <div id="bug-TID-tabpanel-history" tabindex="0" role="tabpanel" aria-hidden="true" aria-labelledby="bug-TID-tab-history">
              <div class="bug-history scrollable" tabindex="0" role="region">
                <section role="group" itemscope itemtype="http://bzdeck.com/History" aria-label="History" data-field="history">
                  <h3>History</h3>
                  <table>
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>Who</th>
                        <th>What</th>
                        <th>Removed</th>
                        <th>Added</th>
                      </tr>
                    </thead>
                    <tbody></tbody>
                  </table>
                </section>
              </div>
            </div><!-- end #bug-TID-tabpanel-history -->
          </div><!-- end #bug-TID-tabpanels -->
          <div id="bug-TID-outline" class="bug-outline scrollable">
          </div><!-- end #bug-TID-outline -->
        </div>
        <div class="att-drop-target" aria-dropeffect="none"><div><label>Drop text or files here to attach</label></div></div>
      </article><!-- end #bug-TID -->
    </template><!-- end #bug-details-template -->
    <template id="bug-details-error-template">
      <article id="bug-TID" role="article" itemscope itemtype="http://bzdeck.com/Bug" data-attrs="data-error-code">
        <header>
          <h2>Bug <span itemprop="id"></span></h2>
        </header>
        <div>
          <p role="status" itemprop="status"></p>
        </div>
      </article><!-- end #bug-TID -->
    </template><!-- end #bug-details-error-template -->
    <template id="preview-bug-info">
      <div class="bug-info" tabindex="0" role="region">
        <dl>
          <dt>Filed</dt><dd><time itemprop="creation_time" data-relative="false"></time></dd>
          <dt>Modified</dt><dd><time itemprop="last_change_time" data-relative="false"></time></dd>
          <dt>Status</dt><dd itemprop="status"></dd>
          <dt>Resolution</dt><dd itemprop="resolution"></dd>
          <dt>Milestone</dt><dd itemprop="target_milestone"></dd>
          <dt>Product</dt><dd itemprop="product"></dd>
          <dt>Component</dt><dd itemprop="component"></dd>
          <dt>Version</dt><dd itemprop="version"></dd>
          <dt>Hardware</dt><dd itemprop="platform"></dd>
          <dt>OS</dt><dd itemprop="op_sys"></dd>
          <dt>Severity</dt><dd itemprop="severity"></dd>
          <dt>Priority</dt><dd itemprop="priority"></dd>
        </dl>
      </div><!-- end .bug-info -->
    </template><!-- end #preview-bug-info -->
    <template id="timeline-comment">
      <article tabindex="0" itemprop="comment" itemscope itemtype="http://bzdeck.com/Comment" role="article">
        <header>
          <div class="meta">
            <span role="link" itemprop="author" itemscope itemtype="http://bzdeck.com/User"><img alt="" itemprop="image"><span itemprop="name"></span><span class="roles"></span><meta itemprop="email"></span>
            <span itemprop="name"></span>
            <time itemprop="creation_time"></time>
          </div>
        </header>
        <p itemprop="extract"></p>
        <div itemprop="text"></div>
        <footer>
          <div role="toolbar">
            <ul role="none">
              <li role="none"><span class="iconic text" title="Reply to this comment" tabindex="0" role="button" data-command="reply">Reply</span></li>
            </ul>
          </div>
        </footer>
      </article>
    </template><!-- end #timeline-comment -->
    <template id="timeline-change">
      <article tabindex="0" itemprop="change" itemscope itemtype="http://bzdeck.com/Change" role="article">
        <header>
          <div class="meta">
            <span role="link" itemprop="author" itemscope itemtype="http://bzdeck.com/User" data-attrs="title"><img alt="" itemprop="image"><strong itemprop="givenName"></strong><meta itemprop="email"></span>
            <span itemprop="how"></span>
            <time itemprop="creation_time"></time>
          </div>
        </header>
      </article>
    </template><!-- end #timeline-change -->
    <template id="bug-comment-form">
      <section role="group" id="bug-TID-comment-form" class="bug-comment-form" aria-label="Comment Form">
        <header>
          <h4>Reply</h4>
          <ul id="bug-TID-comment-form-tablist" tabindex="0" role="tablist" aria-level="2" data-removable="false" data-reorderable="false">
            <li id="bug-TID-comment-form-tab-comment" role="tab" aria-controls="bug-TID-comment-form-tabpanel-comment" aria-selected="true"><label>Comment</label></li>
            <li id="bug-TID-comment-form-tab-preview" role="tab" aria-controls="bug-TID-comment-form-tabpanel-preview" aria-selected="false" aria-disabled="true"><label>Preview</label></li>
            <li id="bug-TID-comment-form-tab-attachments" role="tab" aria-controls="bug-TID-comment-form-tabpanel-attachments" aria-selected="false" aria-disabled="true"><label>Attachments</label></li>
            <li id="bug-TID-comment-form-tab-needinfo" role="tab" aria-controls="bug-TID-comment-form-tabpanel-needinfo" aria-selected="false" aria-hidden="true"><label>Need Info</label></li>
          </ul><!-- end #TID-tablist -->
          <div id="bug-TID-comment-form-text-formatting-toolbar" class="text-formatting-toolbar" role="toolbar" aria-label="Markdown text-formatting toolbar">
            <ul role="group">
              <li role="none"><span class="iconic" title="Insert bold text (Cmd+B)" tabindex="0" role="button" data-command="strong"></span></li>
              <li role="none"><span class="iconic" title="Insert italic text (Cmd+I)" tabindex="0" role="button" data-command="em"></span></li>
              <li role="none"><span class="iconic" title="Insert a link (Cmd+K)" tabindex="0" role="button" data-command="a"></span></li>
            </ul>
            <ul role="group">
              <li role="none"><span class="iconic" title="Insert a header" tabindex="0" role="button" data-command="h2"></span></li>
              <li role="none"><span class="iconic" title="Insert a quote" tabindex="0" role="button" data-command="blockquote"></span></li>
              <li role="none"><span class="iconic" title="Insert code" tabindex="0" role="button" data-command="code"></span></li>
            </ul>
            <ul role="group">
              <li role="none"><span class="iconic" title="Insert a bulleted list" tabindex="0" role="button" data-command="ul"></span></li>
              <li role="none"><span class="iconic" title="Insert a numbered list" tabindex="0" role="button" data-command="ol"></span></li>
            </ul>
          </div><!-- end #TID-text-formatting-toolbar -->
        </header>
        <div>
          <div id="bug-TID-comment-form-tabpanel-comment" tabindex="0" role="tabpanel" aria-hidden="false" aria-labelledby="bug-TID-comment-form-tab-comment">
            <textarea rows="1" placeholder="Leave a comment" role="textbox" aria-multiline="true"></textarea>
          </div><!-- end #TID-tabpanel-comment -->
          <div id="bug-TID-comment-form-tabpanel-preview" tabindex="0" role="tabpanel" aria-hidden="true" aria-labelledby="bug-TID-comment-form-tab-preview">
            <article itemprop="comment" itemscope itemtype="http://bzdeck.com/Comment" role="article">
              <div itemprop="text"></div>
            </article>
          </div><!-- end #TID-tabpanel-preview -->
          <div id="bug-TID-comment-form-tabpanel-attachments" tabindex="0" role="tabpanel" aria-hidden="true" aria-labelledby="bug-TID-comment-form-tab-attachments">
            <div role="group">
              <input type="file" hidden multiple directory>
              <table>
                <colgroup>
                  <col data-id="description">
                  <col data-id="edit">
                  <col data-id="remove">
                  <col data-id="move-up">
                  <col data-id="move-down">
                </colgroup>
                <tbody></tbody>
              </table>
            </div>
          </div><!-- end #TID-tabpanel-attachments -->
          <div id="bug-TID-comment-form-tabpanel-needinfo" tabindex="0" role="tabpanel" aria-hidden="true" aria-labelledby="bug-TID-comment-form-tab-needinfo">
            <div role="group">
              <div class="requestee-finder-outer">
                <label>Ask someone else:</label>
              </div>
            </div> 
          </div><!-- end #TID-tabpanel-needinfo -->
        </div>
        <footer>
          <div role="toolbar">
            <ul role="none">
              <li role="none"><span class="iconic" title="Add attachments..." tabindex="0" role="button" data-command="attach">Attach</span></li>
            </ul>
          </div>
          <div role="status"></div>
          <div role="toolbar">
            <ul role="none">
              <li role="none"><span role="button" aria-disabled="true" data-command="submit">Save Changes</span></li>
            </ul>
          </div>
        </footer>
      </section><!-- end #TID -->
    </template><!-- end #bug-comment-form -->
    <template id="bug-comment-form-request-needinfo-row">
      <div class="request-needinfo-row">
        <meta tabindex="0" role="checkbox" aria-label="Ask"> <strong></strong> <span></span>
      </div>
    </template><!-- end #bug-comment-form-request-needinfo-row -->
    <template id="bug-comment-form-clear-needinfo-row">
      <div class="clear-needinfo-row">
        <meta tabindex="0" role="checkbox" aria-label="Provide information as"> <strong></strong>
      </div>
    </template><!-- end #bug-comment-form-clear-needinfo-row -->
    <template id="bug-comment-form-attachments-row">
      <tr itemscope itemtype="http://bzdeck.com/Attachment">
        <th itemprop="summary"></th>
        <td><span class="iconic" title="Edit" tabindex="0" role="button" data-command="edit">Edit</span></td>
        <td><span class="iconic" title="Remove" tabindex="0" role="button" data-command="remove">Remove</span></td>
        <td><span class="iconic" title="Move Up" tabindex="0" role="button" data-command="move-up">Move Up</span></td>
        <td><span class="iconic" title="Move Down" tabindex="0" role="button" data-command="move-down">Move Down</span></td>
      </tr>
    </template>
    <template id="timeline-attachment">
      <aside role="link" itemprop="attachment" itemscope itemtype="http://bzdeck.com/Attachment" data-attrs="data-att-id">
        <meta itemprop="is_patch">
        <meta itemprop="content_type">
        <h5 itemprop="summary"></h5>
        <div></div>
      </aside>
    </template><!-- end #timeline-attachment -->
    <template id="details-attachment-listitem">
      <li tabindex="0" role="option" aria-selected="false" data-attrs="id aria-hidden data-id data-hash" itemprop="attachment" itemscope itemtype="http://bzdeck.com/Attachment">
        <meta itemprop="id">
        <meta itemprop="is_patch">
        <meta itemprop="is_obsolete">
        <meta itemprop="is_unuploaded">
        <meta itemprop="content_type">
        <span itemprop="creator" itemscope itemtype="http://bzdeck.com/User">
          <img alt="" itemprop="image">
          <meta itemprop="email">
        </span>
        <span itemprop="summary"></span>
        <span><time itemprop="last_change_time"></time></span>
      </li>
    </template><!-- end #details-attachment-listitem -->
    <template id="details-attachment-content">
      <section itemscope itemtype="http://bzdeck.com/Attachment" data-attrs="data-att-id data-att-hash data-content-type">
        <header>
          <h4><span class="distinct" contenteditable="true" role="textbox" itemprop="summary" aria-label="Summary" aria-required="true"></span></h4>
        </header>
        <div class="fields">
          <section class="properties">
            <h5>Properties</h5>
            <ul>
              <li>Name: <span class="distinct" contenteditable="true" role="textbox" itemprop="file_name" aria-label="Name" aria-required="true"></span></li>
              <li>Type: <span class="distinct" contenteditable="true" role="textbox" itemprop="content_type" aria-label="Type" aria-required="true"></span></li>
              <li>Size: <span itemprop="size"></span> <meta tabindex="0" role="checkbox" itemprop="is_patch" aria-label="Patch"> <meta tabindex="0" role="checkbox" itemprop="is_obsolete" aria-label="Obsolete"></li>
              <li>Created on <time itemprop="creation_time" data-relative="false"></time> by <span role="link" itemprop="creator" itemscope itemtype="http://bzdeck.com/User"><img alt="" itemprop="image"><span itemprop="name"></span><meta itemprop="email"></span></li>
              <li>Modified on <time itemprop="last_change_time" data-relative="false"></time></li>
            </ul>
          </section>
          <section class="flags">
            <h5>Flags</h5>
          </section>
        </div><!-- end .fields -->
        <div class="body"></div>
      </section>
    </template><!-- end #details-attachment-content -->
    <template id="details-change">
      <tr itemprop="change" itemscope itemtype="http://bzdeck.com/HistoryChange">
        <td itemprop="when"></td>
        <td itemprop="who"></td>
        <td itemprop="what"></td>
        <td itemprop="removed"></td>
        <td itemprop="added"></td>
      </tr>
    </template><!-- end #details-change -->
    <template id="details-flag">
      <section role="group" itemscope itemtype="http://bzdeck.com/Flag" data-attrs="aria-label data-field data-has-value">
        <h4 itemprop="name" data-attrs="aria-level"></h4>
        <span role="combobox" aria-autocomplete="list" aria-readonly="true" data-attrs="aria-label">
          <span role="searchbox" aria-readonly="true" tabindex="0" itemprop="status"></span>
        </span>
        <span role="link" itemprop="setter" itemscope itemtype="http://bzdeck.com/User"><img alt="" itemprop="image"><span itemprop="givenName"></span><meta itemprop="email"></span>
        <span role="link" itemprop="requestee" itemscope itemtype="http://bzdeck.com/User"><img alt="" itemprop="image"><span itemprop="givenName"></span><meta itemprop="email"></span>
      </section>
    </template><!-- end #details-flag -->
    <template id="details-tracking-flag">
      <section role="group" itemscope itemtype="http://bzdeck.com/TrackingFlag" data-attrs="aria-label data-field data-has-value">
        <h4 itemprop="name"></h4>
        <span role="combobox" aria-autocomplete="list" aria-readonly="true" data-attrs="aria-label">
          <span role="searchbox" aria-readonly="true" tabindex="0" itemprop="value"></span>
        </span>
      </section>
    </template><!-- end #details-tracking-flag -->
    <template id="quicksearch-results-bugs-item">
      <li tabindex="-1" role="menuitem" aria-selected="false" data-attrs="id data-id" itemscope itemtype="http://bzdeck.com/Bug">
        <span itemprop="contributor" itemscope itemtype="http://bzdeck.com/User">
          <img alt="" itemprop="image">
          <meta itemprop="email">
        </span>
        <span itemprop="summary"></span>
        <span><span itemprop="id"></span> <time itemprop="last_change_time"></time></span>
      </li>
    </template><!-- end #quicksearch-results-bugs-item -->
    <template id="quicksearch-results-users-item">
      <li tabindex="-1" role="menuitem" aria-selected="false" data-attrs="id data-id" itemscope itemtype="http://bzdeck.com/User">
        <img alt="" itemprop="image">
        <span itemprop="name"></span>
        <span><span itemprop="alternateName"></span> <span itemprop="email"></span></span>
      </li>
    </template><!-- end #quicksearch-results-users-item -->
    <template id="vertical-thread-item">
      <li tabindex="0" role="option" aria-selected="false" data-attrs="id data-id data-unread" itemscope itemtype="http://bzdeck.com/Bug">
        <div itemprop="contributor" itemscope itemtype="http://bzdeck.com/User">
          <img alt="" itemprop="image">
          <meta itemprop="email">
        </div>
        <div class="labels">
          <div itemprop="summary"></div>
          <ul role="none">
            <li role="none"><span itemprop="id"></span></li>
            <li role="none"><span itemprop="status"></span> <span itemprop="resolution"></span></li>
            <li role="none"><time itemprop="last_change_time"></time></li>
          </ul>
          <p><span itemprop="flag"></span> <span itemprop="extract"></span></p>
        </div>
        <meta role="checkbox" tabindex="0" itemprop="starred" aria-label="Starred">
      </li>
    </template><!-- end #vertical-thread-item -->
    <template id="bug-tooltip">
      <aside role="tooltip" data-attrs="data-id" itemscope itemtype="http://bzdeck.com/Bug">
        <span itemprop="contributor" itemscope itemtype="http://bzdeck.com/User">
          <img alt="" itemprop="image">
          <meta itemprop="email">
        </span>
        <span itemprop="id"></span>
        <span itemprop="summary"></span>
        <time data-simple="true" itemprop="last_change_time"></time>
      </aside>
    </template><!-- end #bug-tooltip -->
    <template id="person-finder">
      <span class="person-finder" role="combobox" aria-autocomplete="none" aria-label="Need Info requestee finder" data-autoexpand="true" data-nobutton="true">
        <span role="searchbox" contenteditable="true" spellcheck="false"></span>
        <ul role="listbox"></ul>
      </span>
    </template><!-- end #person-finder -->
    <template id="person-finder-item">
      <li tabindex="-1" role="option" aria-selected="false" data-attrs="id data-value" itemscope itemtype="http://bzdeck.com/User">
        <img alt="" itemprop="image">
        <span itemprop="name"></span>
        <span itemprop="nick"></span>
        <meta itemprop="email">
      </li>
    </template><!-- end #person-finder-item -->
    <template id="person-with-image">
      <span role="link" itemscope itemtype="http://bzdeck.com/User" data-attrs="title"><img alt="" itemprop="image"><strong itemprop="givenName"></strong><meta itemprop="email"></span>
    </template><!-- end #person-with-image -->
    <template id="bug-participant">
      <li tabindex="0" role="link" itemscope itemtype="http://bzdeck.com/User">
        <meta itemprop="email">
        <meta itemprop="description">
        <img alt="" itemprop="image">
        <span itemprop="name"></span>
      </li>
    </template><!-- end #bug-participant -->
    <template id="qrcode-auth-overlay-template">
      <section id="qrcode-auth-overlay" role="region" aria-hidden="true">
        <header>
          <div class="banner-nav-button" role="button" tabindex="0" aria-label="Back"></div>
          <h2>Scan QR Code</h2>
        </header>
        <div>
          <p>Open BzDeck with Firefox for desktop. Go to the Settings, then tap the button below to scan the displayed QR code.</p>
          <video></video>
          <p><span class="cta" role="button" tabindex="0" aria-disabled="true" data-id="scan">Scan to sign in</span></p>
        </div>
        <iframe hidden src="/integration/qrcode-decoder/"></iframe>
      </section><!-- end #qrcode-auth-overlay -->
    </template><!-- end #qrcode-auth-overlay-template -->
  </head>
  <body role="application">
    <section id="app-login">
      <header>
        <h1>BzDeck</h1>
      </header>
      <div>
        <div>
          <p id="app-intro"><strong>BzDeck</strong> is a useful, experimental Bugzilla client demonstrating modern Web standard technologies. This app is currently optimized for <strong>bugzilla.mozilla.org</strong>. <a href="/about/">Learn more &raquo;</a></p>
          <div role="form" aria-hidden="true">
            <p><span class="cta" role="button" tabindex="0" data-id="bugzilla-auth">Sign in with Bugzilla</span></p>
            <p><span class="cta" role="button" tabindex="0" data-id="qrcode-auth">Sign in with QR code</span></p>
          </div>
          <div class="statusbar" role="status">
            <p>This application requires <a href="https://www.mozilla.org/firefox/developer/">Firefox Developer Edition</a> or <a href="https://nightly.mozilla.org/">Firefox Nightly</a> with JavaScript enabled.</p>
          </div>
        </div>
      </div>
    </section><!-- end #app-login -->
    <section id="app-body" aria-hidden="true">
      <header role="banner">
        <h1 role="button" title="Home">BzDeck</h1>
        <div role="toolbar">
          <div id="quicksearch" title="Search for bugs and people" role="search">
            <input type="search" placeholder="Search for bugs and people" tabindex="1" role="searchbox" aria-haspopup="true" aria-owns="quicksearch-results">
            <span tabindex="0" title="Search" role="button">Go</span>
            <section id="quicksearch-results" role="menu" aria-labelledby="quicksearch-results-title" aria-expanded="false">
              <header>
                <h2 id="quicksearch-results-title">Quick Search Results</h2>
              </header>
              <section id="quicksearch-results-recent" role="group" aria-hidden="true" aria-labelledby="quicksearch-results-recent-title">
                <header>
                  <h3 id="quicksearch-results-recent-title">Recent Searches</h3>
                </header>
                <ul id="quicksearch-results-recent-list"></ul>
              </section>
              <section id="quicksearch-results-bugs" role="group" aria-hidden="true" aria-labelledby="quicksearch-results-bugs-title">
                <header>
                  <h3 id="quicksearch-results-bugs-title">Bugs</h3>
                </header>
                <ul id="quicksearch-results-bugs-list"></ul>
                <footer>
                  <div id="quicksearch-results-bugs-all" tabindex="-1" role="menuitem" aria-selected="false" data-command="search-all-bugs">Search All Bugs...</div>
                </footer>
              </section>
              <section id="quicksearch-results-users" role="group" aria-hidden="true" aria-labelledby="quicksearch-results-users-title">
                <header>
                  <h3 id="quicksearch-results-users-title">People</h3>
                </header>
                <ul id="quicksearch-results-users-list"></ul>
              </section>
            </section><!-- end #quicksearch-results -->
          </div><!-- end #quicksearch -->
        </div><!-- end [role="toolbar"] -->
        <ul id="main-tablist" tabindex="0" role="tablist" aria-level="1" aria-live="true" aria-relevant="additions removals" data-removable="true" data-reorderable="false">
          <li id="tab-home" title="Home" draggable="true" role="tab" aria-controls="tabpanel-home" aria-grabbed="false" aria-selected="true"><label>Home</label></li>
        </ul><!-- end #main-tablist -->
      </header>
      <aside id="sidebar" tabindex="0" role="complementary">
        <div tabindex="0" role="region">
          <section id="sidebar-account">
            <h2>Account</h2>
            <span id="main-menu-app-account" role="button" tabindex="0" aria-label="Profile" data-tooltip-position="right">
              <label itemscope itemtype="http://bzdeck.com/User">
                <img alt="" itemprop="image">
                <strong itemprop="name"></strong>
                <span itemprop="email"></span>
              </label>
            </span>
          </section><!-- end #sidebar-account -->
          <section id="sidebar-folders">
            <h2>Bugs</h2>
            <ul id="sidebar-folder-list" role="listbox" tabindex="0" aria-multiselectable="false"></ul>
          </section><!-- end #sidebar-folders -->
          <section id="sidebar-menu">
            <h2>Menu</h2>
            <ul id="main-menu-app-menu" role="menu">
              <li role="none"><a id="main-menu-app-about" href="/about/" aria-label="About BzDeck" role="menuitem" data-command="show-about" data-tooltip-position="right"><label>About BzDeck</label></a></li>
              <li role="none"><span id="main-menu-app-settings" aria-label="Settings" role="menuitem" data-command="show-settings" data-tooltip-position="right"><label>Settings</label></span></li>
            </ul><!-- end #main-menu-app-menu -->
          </section><!-- end #sidebar-menu -->
        </div>
      </aside><!-- end #sidebar -->
      <main role="main">
        <div id="main-tabpanels">
          <div id="tabpanel-home" tabindex="0" role="tabpanel" aria-hidden="false" aria-labelledby="tab-home">
            <section>
              <header>
                <h2>Inbox</h2>
              </header>
              <div>
                <div id="home-list-pane" tabindex="0" role="region">
                  <header>
                    <div class="banner-nav-button iconic" tabindex="0" role="button" aria-label="Menu"></div>
                    <h3>Inbox</h3>
                    <div id="home-list-searchbar" role="search">
                      <span class="iconic" tabindex="0" role="button" aria-label="Search" data-id="search"></span>
                      <input placeholder="Search all bugs..." tabindex="0" role="searchbox">
                      <span class="iconic" tabindex="0" role="button" aria-label="Close" data-id="close"></span>
                    </div>
                  </header>
                  <section id="home-list" class="bug-list" role="grid" aria-live="true" aria-relevant="additions removals" aria-labelledby="home-list-title" aria-multiselectable="true" aria-readonly="true" data-selection="rows">
                  </section>
                  <section id="home-vertical-thread" tabindex="0" role="region">
                    <header role="toolbar">
                      <ul class="filter" role="radiogroup" aria-label="Filter Bugs by Status">
                        <li role="radio" data-value="open">Open</li>
                        <li role="radio" data-value="closed">Closed</li>
                        <li role="radio" data-value="all">All</li>
                      </ul>
                      <div class="iconic" tabindex="0" role="button" aria-pressed="false" data-command="sort" aria-label="Sort Bugs in Ascending Order"></div>
                      <div class="iconic" tabindex="0" role="button" aria-pressed="false" aria-haspopup="true" aria-label="Show menu for the thread" aria-owns="home-vertical-thread-menu" data-command="show-menu"></div>
                      <ul id="home-vertical-thread-menu" role="menu" aria-expanded="false">
                        <li role="none">
                          <a id="home-vertical-thread-menu-mark-all-read" role="menuitem" data-command="mark-all-read"><label>Mark All Bugs as Read</label></a>
                        </li>
                      </ul>
                    </header>
                    <div class="scrollable">
                      <ul tabindex="0" role="listbox" aria-live="true" aria-relevant="additions removals" aria-multiselectable="true"></ul>
                    </div>
                  </section>
                  <footer aria-hidden="true">
                    <div role="status"><span>No bugs found in this folder.</span></div>
                  </footer>
                </div><!-- end #home-list-pane -->
                <div id="home-preview-pane" class="bug-container" tabindex="0" role="region" aria-expanded="false"></div>
              </div>
            </section>
          </div><!-- end #tabpanel-home -->
        </div><!-- end #main-tabpanels -->
      </main>
      <div class="statusbar" role="status">
        <p></p>
        <div role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"></div>
      </div>
    </section><!-- end #app-body -->
    <div itemscope itemtype="http://schema.org/Organization">
      <meta itemprop="name" content="BzDeck">
      <meta itemprop="url" content="https://www.bzdeck.com/">
      <meta itemprop="sameAs" content="https://twitter.com/BzDeck">
      <meta itemprop="sameAs" content="https://www.facebook.com/BzDeck">
      <meta itemprop="sameAs" content="https://plus.google.com/+BzDeck">
    </div>
    <div itemscope itemtype="http://schema.org/WebApplication">
      <meta itemprop="name" content="BzDeck">
      <meta itemprop="description" content="A useful, experimental Bugzilla client demonstrating modern Web application technologies such as CSS3, DOM4, HTML5, ECMAScript 6 and WAI-ARIA.">
      <meta itemprop="url" content="https://www.bzdeck.com/">
      <meta itemprop="image" content="https://www.bzdeck.com/static/images/logo/icon-512.png">
      <meta itemprop="screenshot" content="https://pbs.twimg.com/media/BlOQQwjCQAEfB27.png:large">
      <div itemprop="author" itemscope itemtype="http://schema.org/Organization">
        <meta itemprop="name" content="Team BzDeck">
        <meta itemprop="url" content="https://github.com/bzdeck">
      </div>
      <div itemprop="offers" itemscope itemtype="http://schema.org/Offer">
        <meta itemprop="price" content="0">
      </div>
      <meta itemprop="applicationCategory" content="BusinessApplication">
      <meta itemprop="operatingSystem" content="Windows">
      <meta itemprop="operatingSystem" content="Mac">
      <meta itemprop="operatingSystem" content="Linux">
      <meta itemprop="operatingSystem" content="Android">
      <meta itemprop="browserRequirements" content="Firefox Developer Edition">
      <meta itemprop="browserRequirements" content="Firefox Nightly">
    </div>
<?php output_link_elements('js') ?>
  </body>
</html>
