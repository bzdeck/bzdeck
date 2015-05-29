<!DOCTYPE html>
<!-- This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/. -->
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
    <link rel="canonical" href="https://www.bzdeck.com/">
    <link rel="publisher" href="https://plus.google.com/+BzDeck">
    <link rel="stylesheet" type="text/css" media="screen,tv" href="/vendor/flaretail.js/styles/widget.css">
    <link rel="stylesheet" type="text/css" media="screen,tv" href="/static/styles/base.css">
    <link rel="stylesheet" type="text/css" media="screen,tv" href="/static/styles/themes/light.css" title="Light">
    <link rel="stylesheet" type="text/css" media="screen,tv" href="/static/styles/themes/dark.css" title="Dark">
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
    </template><!-- end #tabpanel-search -->
    <template id="tabpanel-details-template">
      <div id="tabpanel-details-TID" tabindex="0" role="tabpanel" aria-labelledby="tab-details-TID">
      </div><!-- end #tabpanel-details-TID -->
    </template><!-- end #tabpanel-details -->
    <template id="tabpanel-attachment-template">
      <div id="tabpanel-attachment-TID" tabindex="0" role="tabpanel" aria-labelledby="tab-attachment-TID">
        <article id="attachment-TID" role="article">
          <header>
            <h2>Attachment <span itemprop="id"></span></h2>
          </header>
          <div role="region"></div>
        </article>
      </div><!-- end #tabpanel-attachment-TID -->
    </template><!-- end #tabpanel-attachment -->
    <template id="tabpanel-settings-template">
      <div id="tabpanel-settings" tabindex="0" role="tabpanel" aria-labelledby="tab-settings">
        <section>
          <header>
            <h2>Settings</h2>
          </header>
          <div>
            <ul id="settings-tablist" tabindex="0" role="tablist" data-removable="false" data-reorderable="false">
              <li id="settings-tab-account" role="tab" aria-controls="settings-tabpanel-account" aria-selected="true"><label>Account</label></li>
              <li id="settings-tab-design" role="tab" aria-controls="settings-tabpanel-design" aria-selected="false"><label>Design</label></li>
              <li id="settings-tab-datetime" role="tab" aria-controls="settings-tabpanel-datetime" aria-selected="false"><label>Date &amp; Time</label></li>
              <li id="settings-tab-notifications" role="tab" aria-controls="settings-tabpanel-notifications" aria-selected="false"><label>Notifications</label></li>
              <li id="settings-tab-timeline" role="tab" aria-controls="settings-tabpanel-timeline" aria-selected="false"><label>Timeline</label></li>
            </ul><!-- end #settings-tablist -->
            <div id="settings-tabpanel-account" tabindex="0" role="tabpanel" aria-hidden="false" aria-labelledby="settings-tab-account">
              <section>
                <h3>Account</h3>
                <section>
                  <h4>Bugzilla API Key</h4>
                  <div><input maxlength="40" role="textbox"><output role="status"></output></div>
                  <p>Provide your <a>API Key</a> if you'd make changes to bugs. It will be saved in your local browser storage, used only for Bugzilla user authentication when needed, and never sent to the BzDeck server nor any other third parties.</p>
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
                    <li role="none"><span role="radio" data-value="local">Your local time</span></li>
                    <li role="none"><span role="radio" data-value="UTC">UTC</span></li>
                    <li role="none"><span role="radio" data-value="PST">PST/PDT</span></li>
                  </ul>
                </section>
                <section>
                  <h4>Date Format</h4>
                  <ul role="radiogroup" data-pref="ui.date.relative">
                    <li role="none"><span role="radio" data-value="true">Relative</span></li>
                    <li role="none"><span role="radio" data-value="false">Absolute</span></li>
                  </ul>
                </section>
              </section>
            </div><!-- end #settings-tabpanel-datetime -->
            <div id="settings-tabpanel-notifications" tabindex="0" role="tabpanel" aria-hidden="true" aria-labelledby="settings-tab-notifications">
              <section>
                <h3>Notifications</h3>
                <section>
                  <h4>Desktop Notifications</h4>
                  <ul role="radiogroup" data-pref="notifications.show_desktop_notifications">
                    <li role="none"><span role="radio" data-value="true">Show if possible</span></li>
                    <li role="none"><span role="radio" data-value="false">Don't show</span></li>
                  </ul>
                </section>
                <section>
                  <h4>CC Changes</h4>
                  <ul role="radiogroup" data-pref="notifications.ignore_cc_changes">
                    <li role="none"><span role="radio" data-value="true">Ignore</span></li>
                    <li role="none"><span role="radio" data-value="false">Include</span></li>
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
                  <ul role="radiogroup" data-pref="ui.timeline.show_cc_changes">
                    <li role="none"><span role="radio" data-value="true">Show</span></li>
                    <li role="none"><span role="radio" data-value="false">Hide</span></li>
                  </ul>
                </section>
                <section>
                  <h4>Media Attachments</h4>
                  <ul role="radiogroup" data-pref="ui.timeline.display_attachments_inline">
                    <li role="none"><span role="radio" data-value="true">Show inline</span></li>
                    <li role="none"><span role="radio" data-value="false">Hide</span></li>
                  </ul>
                </section>
              </section>
            </div><!-- end #settings-tabpanel-timeline -->
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
            <article id="profile-TID" role="article" itemscope itemtype="http://schema.org/Person http://bzdeck.com/Person">
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
            </article>
          </div>
          <footer>
            <div role="status"></div>
          </footer>
        </section>
      </div><!-- end #tabpanel-profile -->
    </template><!-- end #tabpanel-profile-template -->
    <template id="home-preview-bug-template">
      <article id="home-preview-bug" role="article" aria-hidden="true" itemscope itemtype="http://bzdeck.com/Bug">
        <header>
          <h3>Bug <span itemprop="id"></span></h3>
          <div role="toolbar">
            <ul role="none">
              <li role="none"><span class="iconic" title="Star this bug" tabindex="0" role="button" aria-pressed="false" data-command="star" data-field="starred">Star</span></li>
              <li role="none"><span class="iconic" title="Open this bug in a new tab" tabindex="0" role="button" data-command="show-details">Show Details</span></li>
              <li role="none"><span class="iconic" title="Menu" tabindex="0" role="button" aria-pressed="false" aria-haspopup="true" aria-owns="home-preview-bug-menu" data-command="show-menu">Menu</span></li>
            </ul>
            <ul id="home-preview-bug-menu" role="menu" aria-expanded="false">
              <li role="none">
                <a id="home-preview-bug-menu--toggle-comments" role="menuitem"><label>Expand All Comments</label></a>
                <a id="home-preview-bug-menu--toggle-cc" role="menuitem"><label>Show CC Changes</label></a>
              </li>
              <li role="separator"></li>
              <li role="none">
                <a id="home-preview-bug-menu--open-bugzilla" role="menuitem" data-command="open-bugzilla"><label>Open in Bugzilla</label></a>
                <a id="home-preview-bug-menu--tweet" role="menuitem" data-command="tweet"><label>Tweet</label></a>
              </li>
            </ul>
          </div>
        </header>
        <div id="home-preview-bug-timeline-wrapper" class="bug-timeline-wrapper">
          <div id="home-preview-bug-timeline" class="bug-timeline" role="region" tabindex="0">
            <h3 itemprop="summary"></h3>
            <div class="comments-wrapper"></div>
          </div>
        </div>
      </article><!-- end #home-preview-bug -->
    </template><!-- end #home-preview-bug-template -->
    <template id="search-preview-bug-template">
      <article id="search-TID-preview-bug" role="article" aria-hidden="true" itemscope itemtype="http://bzdeck.com/Bug">
        <header>
          <h3>Bug <span itemprop="id"></span></h3>
          <div role="toolbar">
            <ul role="none">
              <li role="none"><span class="iconic" title="Star this bug" tabindex="0" role="button" aria-pressed="false" data-command="star" data-field="starred">Star</span></li>
              <li role="none"><span class="iconic" title="Open this bug in a new tab" tabindex="0" role="button" data-command="show-details">Show Details</span></li>
              <li role="none"><span class="iconic" title="Menu" tabindex="0" role="button" aria-pressed="false" aria-haspopup="true" aria-owns="search-TID-preview-bug-menu" data-command="show-menu">Menu</span></li>
            </ul>
            <ul role="none">
              <li role="none"><span class="iconic" title="Show the query pane to search again" tabindex="0" role="button" data-command="show-basic-search-pane">Search Again</span></li>
            </ul>
            <ul id="search-TID-preview-bug-menu" role="menu" aria-expanded="false">
              <li role="none">
                <a id="search-TID-preview-bug-menu--toggle-comments" role="menuitem"><label>Expand All Comments</label></a>
                <a id="search-TID-preview-bug-menu--toggle-cc" role="menuitem"><label>Show CC Changes</label></a>
              </li>
              <li role="separator"></li>
              <li role="none">
                <a id="search-TID-preview-bug-menu--open-bugzilla" role="menuitem" data-command="open-bugzilla"><label>Open in Bugzilla</label></a>
                <a id="search-TID-preview-bug-menu--tweet" role="menuitem" data-command="tweet"><label>Tweet</label></a>
              </li>
            </ul>
          </div>
        </header>
        <div id="search-TID-preview-bug-timeline-wrapper" class="bug-timeline-wrapper">
          <div id="search-TID-preview-bug-timeline" class="bug-timeline" role="region" tabindex="0">
            <h3 itemprop="summary"></h3>
            <div class="comments-wrapper"></div>
          </div>
        </div>
      </article><!-- end #search-TID-preview-bug -->
    </template><!-- end #search-preview-bug-template -->
    <template id="bug-details-template">
      <article id="bug-TID" role="article" itemscope itemtype="http://bzdeck.com/Bug">
        <header>
          <h2>Bug <span itemprop="id"></span></h2>
          <div role="toolbar">
            <ul role="none">
              <li role="none"><span class="iconic" title="Star this bug" tabindex="0" role="button" aria-pressed="false" data-command="star" data-field="starred">Star</span></li>
              <li role="none"><span class="iconic" title="Menu" tabindex="0" role="button" aria-pressed="false" aria-haspopup="true" aria-owns="bug-TID-menu" data-command="show-menu">Menu</span></li>
            </ul>
            <ul class="nav" role="none">
              <li role="none"><span class="iconic" title="Show the previous bug" tabindex="0" role="button" aria-disabled="true" data-command="nav-back">Back</span></li>
              <li role="none"><span class="iconic" title="Show the next bug" tabindex="0" role="button" aria-disabled="true" data-command="nav-forward">Forward</span></li>
            </ul>
            <ul id="bug-TID-menu" role="menu" aria-expanded="false">
              <li role="none">
                <a id="bug-TID-preview-bug-menu--toggle-comments" role="menuitem"><label>Expand All Comments</label></a>
                <a id="bug-TID-preview-bug-menu--toggle-cc" role="menuitem"><label>Show CC Changes</label></a>
              </li>
              <li role="separator"></li>
              <li role="none">
                <a id="bug-TID-menu--open-bugzilla" role="menuitem" data-command="open-bugzilla"><label>Open in Bugzilla</label></a>
                <a id="bug-TID-menu--tweet" role="menuitem" data-command="tweet"><label>Tweet</label></a>
              </li>
            </ul>
          </div>
        </header>
        <div>
          <ul id="bug-TID-tablist" tabindex="0" role="tablist" data-removable="false" data-reorderable="false">
            <li id="bug-TID-tab-timeline" role="tab" aria-controls="bug-TID-tabpanel-timeline" aria-selected="true"><label>Timeline</label></li>
            <li id="bug-TID-tab-info" role="tab" aria-controls="bug-TID-tabpanel-info" aria-selected="false"><label>Info</label></li>
            <li id="bug-TID-tab-participants" role="tab" aria-controls="bug-TID-tabpanel-participants" aria-selected="false"><label>Participants</label></li>
            <li id="bug-TID-tab-attachments" role="tab" aria-controls="bug-TID-tabpanel-attachments" aria-disabled="true" aria-selected="false"><label>Attachments</label></li>
            <li id="bug-TID-tab-history" role="tab" aria-controls="bug-TID-tabpanel-history" aria-disabled="true" aria-selected="false"><label>History</label></li>
          </ul>
          <div id="bug-TID-tabpanels">
            <div id="bug-TID-tabpanel-timeline" tabindex="0" role="tabpanel" aria-hidden="false" aria-labelledby="bug-TID-tab-timeline">
              <div class="bug-timeline-wrapper">
                <div class="bug-timeline" role="region" tabindex="0">
                  <section>
                    <h3 itemprop="summary"></h3>
                    <section class="user-story" data-if="cf_user_story">
                      <h4>User Story</h4>
                      <div itemprop="cf_user_story"></div>
                    </section>
                    <div class="comments-wrapper"></div>
                  </section>
                </div>
              </div>
            </div><!-- end #bug-TID-tabpanel-timeline -->
            <div id="bug-TID-tabpanel-info" tabindex="0" role="tabpanel" aria-hidden="true" aria-labelledby="bug-TID-tab-info">
              <div id="bug-TID-info" class="bug-info" tabindex="0" role="region">
                <section>
                  <h3>Status</h3>
                  <dl>
                    <dt>Filed</dt><dd><time itemprop="creation_time" data-relative="false"></time></dd>
                    <dt>Last Modified</dt><dd><time itemprop="last_change_time" data-relative="false"></time></dd>
                    <dt>Status</dt><dd itemprop="status"></dd>
                    <dt>Resolution</dt><dd itemprop="resolution"></dd>
                    <dt>Target Milestone</dt><dd itemprop="target_milestone"></dd>
                  </dl>
                </section>
                <section>
                  <h3>Affected</h3>
                  <dl>
                    <dt>Product</dt><dd itemprop="product"></dd>
                    <dt>Component</dt><dd itemprop="component"></dd>
                    <dt>Version</dt><dd itemprop="version"></dd>
                    <dt>Hardware</dt><dd itemprop="platform"></dd>
                    <dt>OS</dt><dd itemprop="op_sys"></dd>
                  </dl>
                </section>
                <section>
                  <h3>Importance</h3>
                  <dl>
                    <dt>Severity</dt><dd itemprop="severity"></dd>
                    <dt>Priority</dt><dd itemprop="priority"></dd>
                    <!-- Not available via API: <dt>Votes</dt><dd></dd> -->
                  </dl>
                </section>
                <section>
                  <h3>Notes</h3>
                  <dl>
                    <dt>Alias</dt><dd itemprop="alias"></dd>
                    <dt>Keywords</dt><dd><ul><li itemprop="keyword" role="button"></li></ul></dd>
                    <dt>Whiteboard</dt><dd itemprop="whiteboard"></dd>
                    <dt>URL</dt><dd><a role="link" itemprop="url"></a></dd>
                    <dt>See Also</dt><dd><ul><li><a role="link" itemprop="see_also"></a></li></ul></dd>
                    <!-- Not available via API: <dt>Crash Signature</dt><dd></dd> -->
                  </dl>
                </section>
                <section>
                  <h3>Dependencies</h3>
                  <dl>
                    <dt>Depends on</dt><dd><ul><li role="button" itemprop="depends_on"></li></ul></dd>
                    <dt>Blocks</dt><dd><ul><li role="button" itemprop="blocks"></li></ul></dd>
                  </dl>
                </section>
                <section data-field="flags">
                  <h3>Flags</h3>
                  <ul>
                    <li itemprop="flag" itemscope itemtype="http://bzdeck.com/Flag">
                      <span role="link" itemprop="creator" itemscope itemtype="http://schema.org/Person"><span itemprop="name"></span><meta itemprop="email"></span>:
                      <span itemprop="name"></span>
                      <span itemprop="status"></span>
                    </li>
                  </ul>
                </section>
                <!--
                <section>
                  <h3>Project Flags</h3>
                  <dl></dl>
                </section>
                <section>
                  <h3>Tracking Flags</h3>
                  <dl></dl>
                </section>
                -->
              </div><!-- end .bug-info -->
            </div><!-- end #bug-TID-tabpanel-info -->
            <div id="bug-TID-tabpanel-participants" tabindex="0" role="tabpanel" aria-hidden="true" aria-labelledby="bug-TID-tab-participants">
              <div id="bug-TID-participants" class="bug-participants" tabindex="0" role="region">
                <section>
                  <h3>Participants</h3>
                  <dl>
                    <dt>Reporter</dt>
                    <dd><span tabindex="0" role="link" itemprop="creator" itemscope itemtype="http://schema.org/Person"><img alt="" itemprop="image"><span itemprop="name"></span><meta itemprop="email"></span></dd>
                    <dt>Assignee</dt>
                    <dd><span tabindex="0" role="link" itemprop="assigned_to" itemscope itemtype="http://schema.org/Person"><img alt="" itemprop="image"><span itemprop="name"></span><meta itemprop="email"></span></dd>
                    <dt>Mentors</dt>
                    <dd><span tabindex="0" role="link" itemprop="mentor" itemscope itemtype="http://schema.org/Person"><img alt="" itemprop="image"><span itemprop="name"></span><meta itemprop="email"></span></dd>
                    <dt>QA</dt>
                    <dd><span tabindex="0" role="link" itemprop="qa_contact" itemscope itemtype="http://schema.org/Person"><img alt="" itemprop="image"><span itemprop="name"></span><meta itemprop="email"></span></dd>
                    <dt>Contributors</dt>
                    <dd><span tabindex="0" role="link" itemprop="contributor" itemscope itemtype="http://schema.org/Person"><img alt="" itemprop="image"><span itemprop="name"></span><meta itemprop="email"></span></dd>
                    <dt>Cc</dt>
                    <dd><span tabindex="0" role="link" itemprop="cc" itemscope itemtype="http://schema.org/Person"><img alt="" itemprop="image"><span itemprop="name"></span><meta itemprop="email"></span></dd>
                  </dl>
                </section>
              </div><!-- end .bug-participants -->
            </div><!-- end #bug-TID-tabpanel-participants -->
            <div id="bug-TID-tabpanel-attachments" tabindex="0" role="tabpanel" aria-hidden="true" aria-labelledby="bug-TID-tab-attachments">
              <div class="bug-attachments" tabindex="0">
                <section data-field="attachments">
                  <h3>Attachments</h3>
                  <div class="list">
                    <header>
                      <h4>0 Attachments</h4>
                      <span tabindex="0" role="checkbox" aria-checked="false">Show Obsolete</span>
                    </header>
                    <div role="region">
                      <ul tabindex="0" role="listbox"></ul>
                    </div>
                  </div>
                  <div class="content" role="region">
                  </div>
                </section>
              </div>
            </div><!-- end #bug-TID-tabpanel-attachments -->
            <div id="bug-TID-tabpanel-history" tabindex="0" role="tabpanel" aria-hidden="true" aria-labelledby="bug-TID-tab-history">
              <div class="bug-history" tabindex="0" role="region">
                <section data-field="history">
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
        </div>
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
          <dt>Last Modified</dt><dd><time itemprop="last_change_time" data-relative="false"></time></dd>
          <dt>Status</dt><dd itemprop="status"></dd>
          <dt>Resolution</dt><dd itemprop="resolution"></dd>
          <dt>Target Milestone</dt><dd itemprop="target_milestone"></dd>
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
      <article tabindex="0" itemprop="comment" itemscope itemtype="http://schema.org/Comment" role="article">
        <header>
          <div class="meta">
            <span role="link" itemprop="author" itemscope itemtype="http://schema.org/Person"><img alt="" itemprop="image"><span itemprop="name"></span><span class="roles"></span><meta itemprop="email"></span>
            <time itemprop="datePublished"></time>
          </div>
          <div role="toolbar">
            <ul role="none">
              <li role="none"><span class="iconic" title="Reply to this comment" tabindex="0" role="button" data-command="reply">Reply</span></li>
            </ul>
          </div>
        </header>
        <div itemprop="text"></div>
      </article>
    </template><!-- end #timeline-comment -->
    <template id="timeline-change">
      <article tabindex="0" itemprop="change" itemscope itemtype="http://bzdeck.com/Change" role="article">
        <header>
          <div class="meta">
            <span role="link" itemprop="author" itemscope itemtype="http://schema.org/Person" data-attrs="title"><img alt="" itemprop="image"><span itemprop="givenName"></span><meta itemprop="email"></span>
            <span itemprop="how"></span>
            <time itemprop="datePublished"></time>
          </div>
        </header>
      </article>
    </template><!-- end #timeline-change -->
    <template id="timeline-comment-form">
      <section id="TID-comment-form" role="form">
        <header>
          <h4>Reply</h4>
        </header>
        <div>
          <ul id="TID-comment-form-tablist" tabindex="0" role="tablist" data-removable="false" data-reorderable="false">
            <li id="TID-comment-form-tab-comment" role="tab" aria-controls="TID-comment-form-tabpanel-comment" aria-selected="true"><label>Comment</label></li>
            <li id="TID-comment-form-tab-preview" role="tab" aria-controls="TID-comment-form-tabpanel-preview" aria-selected="false" aria-disabled="true"><label>Preview</label></li>
            <li id="TID-comment-form-tab-attachments" role="tab" aria-controls="TID-comment-form-tabpanel-attachments" aria-selected="false" aria-disabled="true"><label>Attachments</label></li>
            <li id="TID-comment-form-tab-status" role="tab" aria-controls="TID-comment-form-tabpanel-status" aria-selected="false" aria-disabled="true"><label>Status</label></li>
            <li id="TID-comment-form-tab-needinfo" role="tab" aria-controls="TID-comment-form-tabpanel-needinfo" aria-selected="false" aria-disabled="true"><label>Need Info</label></li>
          </ul>
          <div id="TID-comment-form-tabpanel-comment" tabindex="0" role="tabpanel" aria-hidden="false" aria-labelledby="TID-comment-form-tab-comment">
            <textarea rows="1" placeholder="Comment" role="textbox" aria-multiline="true"></textarea>
          </div>
          <div id="TID-comment-form-tabpanel-preview" tabindex="0" role="tabpanel" aria-hidden="true" aria-labelledby="TID-comment-form-tab-preview">
            <article itemprop="comment" itemscope itemtype="http://schema.org/Comment" role="article">
              <div role="text" itemprop="text"></div>
            </article>
          </div>
          <div id="TID-comment-form-tabpanel-attachments" tabindex="0" role="tabpanel" aria-hidden="true" aria-labelledby="TID-comment-form-tab-attachments">
            <div>
              <input type="file" hidden multiple>
              <span tabindex="0" role="checkbox" aria-checked="true" aria-hidden="true">Upload files in parallel</span>
              <table>
                <colgroup><col class="description"><col class="actions"></colgroup>
                <tbody></tbody>
              </table>
            </div>
          </div>
          <div id="TID-comment-form-tabpanel-status" tabindex="0" role="tabpanel" aria-hidden="true" aria-labelledby="TID-comment-form-tab-status">
            <div>
              <span class="status" role="combobox" aria-label="Status" aria-autocomplete="list" aria-readonly="true"></span>
              <span class="resolution" role="combobox" aria-label="Resolution" aria-autocomplete="list" aria-readonly="true" aria-hidden="true"></span>
              <label id="TID-comment-form-tabpanel-status-dupe" aria-hidden="true">of Bug <input size="8" pattern="^\d+$" role="searchbox"></label>
            </div>
          </div>
          <div id="TID-comment-form-tabpanel-needinfo" tabindex="0" role="tabpanel" aria-hidden="true" aria-labelledby="TID-comment-form-tab-needinfo">
            <div>
              <div class="requestee-finder-outer">
                <label>Ask someone else:</label>
              </div>
            </div> 
          </div>
        </div>
        <footer>
          <div role="toolbar">
            <ul role="none">
              <li role="none"><span class="iconic" title="Attach Files..." tabindex="0" role="button" data-command="attach">Attach</span></li>
            </ul>
          </div>
          <div role="status"></div>
          <div role="toolbar">
            <ul role="none">
              <li role="none"><span role="button" aria-disabled="true" data-command="submit">Post</span></li>
            </ul>
          </div>
        </footer>
        <div aria-dropeffect="none"><label>Drop text or files here to attach</label></div>
      </section>
    </template><!-- end #timeline-comment-form -->
    <template id="timeline-comment-form-request-needinfo-row">
      <div class="request-needinfo-row">
        <span tabindex="0" role="checkbox">Ask <strong></strong> <span></span></span>
      </div>
    </template><!-- end #timeline-comment-form-request-needinfo-row -->
    <template id="timeline-comment-form-clear-needinfo-row">
      <div class="clear-needinfo-row">
        <span tabindex="0" role="checkbox">Provide information as <strong></strong></span>
      </div>
    </template><!-- end #timeline-comment-form-clear-needinfo-row -->
    <template id="timeline-comment-form-attachments-row">
      <tr>
        <td><input spellcheck="false" role="textbox" data-field="description"></td>
        <td>
          <span title="Edit" role="button" data-command="edit" aria-disabled="true">Edit</span>
          <span title="Remove" tabindex="0" role="button" data-command="remove">Remove</span>
          <span title="Move Up" tabindex="0" role="button" data-command="move-up">Move Up</span>
          <span title="Move Down" tabindex="0" role="button" data-command="move-down">Move Down</span>
        </td>
      </tr>
    </template>
    <template id="timeline-attachment">
      <aside role="link" itemprop="attachment" itemscope itemtype="http://schema.org/MediaObject http://bzdeck.com/Attachment" data-attrs="data-attachment-id data-content-type">
        <h5 itemprop="description"></h5>
        <meta itemprop="name">
        <meta itemprop="contentSize">
        <meta itemprop="encodingFormat">
        <div></div>
      </aside>
    </template><!-- end #timeline-attachment -->
    <template id="details-attachment-listitem">
      <li tabindex="0" role="option" aria-selected="false" data-attrs="id aria-disabled data-id" itemprop="attachment" itemscope itemtype="http://bzdeck.com/Attachment">
        <meta itemprop="encodingFormat">
        <meta itemprop="is_obsolete">
        <span itemprop="creator" itemscope itemtype="http://schema.org/Person">
          <img alt="" itemprop="image">
          <meta itemprop="email">
        </span>
        <span itemprop="id"></span>
        <span itemprop="description"></span>
        <time data-simple="true" itemprop="dateModified"></time>
      </li>
    </template><!-- end #details-attachment-listitem -->
    <template id="details-attachment-content">
      <section itemscope itemtype="http://schema.org/MediaObject http://bzdeck.com/Attachment" data-attrs="data-attachment-id data-content-type">
        <header>
          <h4 itemprop="description"></h4>
          <ul>
            <li><span itemprop="name"></span> &nbsp; <span itemprop="contentSize"></span> &nbsp; <meta itemprop="encodingFormat"> &nbsp; <meta itemprop="is_obsolete"></li>
            <li>Created: <time itemprop="dateCreated" data-relative="false"></time> &nbsp; Modified: <time itemprop="dateModified" data-relative="false"></time></li>
            <li role="link" itemprop="creator" itemscope itemtype="http://schema.org/Person"><img alt="" itemprop="image"><span itemprop="name"></span><meta itemprop="email"></li>
            <li>
              <ul>
                <li itemprop="flag" itemscope itemtype="http://bzdeck.com/Flag">
                  <span role="link" itemprop="creator" itemscope itemtype="http://schema.org/Person"><img alt="" itemprop="image"><span itemprop="name"></span><meta itemprop="email"></span>:
                  <span itemprop="name"></span>
                  <span itemprop="status"></span>
                </li>
              </ul>
            </li>
          </ul>
        </header>
        <div class="body"></div>
      </section>
    </template><!-- end #details-attachment-content -->
    <template id="details-change">
      <tr>
        <td data-field="when"></td>
        <td data-field="who"></td>
        <td data-field="what"></td>
        <td data-field="removed"></td>
        <td data-field="added"></td>
      </tr>
    </template><!-- end #details-change -->
    <template id="vertical-thread-item">
      <li tabindex="0" role="option" aria-selected="false" data-attrs="id data-id data-unread" itemscope itemtype="http://bzdeck.com/Bug">
        <span itemprop="contributor" itemscope itemtype="http://schema.org/Person">
          <img alt="" itemprop="image">
          <meta itemprop="email">
        </span>
        <span itemprop="id"></span>
        <span itemprop="name"></span>
        <time data-simple="true" itemprop="dateModified"></time>
        <span data-field="starred" tabindex="0" role="checkbox" data-attrs="aria-checked"></span>
      </li>
    </template><!-- end #vertical-thread-item -->
    <template id="bug-tooltip">
      <aside role="tooltip" data-attrs="data-id" itemscope itemtype="http://bzdeck.com/Bug">
        <span itemprop="contributor" itemscope itemtype="http://schema.org/Person">
          <img alt="" itemprop="image">
          <meta itemprop="email">
        </span>
        <span itemprop="id"></span>
        <span itemprop="name"></span>
        <time data-simple="true" itemprop="dateModified"></time>
      </aside>
    </template><!-- end #bug-tooltip -->
    <template id="person-finder">
      <span class="person-finder" role="combobox" aria-autocomplete="none" aria-label="Need Info requestee finder" data-autoexpand="true" data-nobutton="true">
        <span spellcheck="false" role="searchbox"></span>
        <ul role="listbox"></ul>
      </span>
    </template><!-- end #person-finder -->
    <template id="person-finder-item">
      <li tabindex="-1" role="option" aria-selected="false" data-attrs="id data-value" itemscope itemtype="http://schema.org/Person">
        <img alt="" itemprop="image">
        <span itemprop="name"></span>
        <span itemprop="nick"></span>
        <meta itemprop="email">
      </li>
    </template><!-- end #person-finder-item -->
    <template id="person-with-image">
      <span role="link" itemscope itemtype="http://schema.org/Person" data-attrs="title"><img alt="" itemprop="image"><span itemprop="givenName"></span><meta itemprop="email"></span>
    </template><!-- end #person-with-image -->
  </head>
  <body role="application">
    <section id="app-login">
      <header>
        <h1>BzDeck</h1>
      </header>
      <div>
        <div>
          <p id="app-intro">BzDeck is a useful, experimental Bugzilla client demonstrating modern Web application technologies such as CSS3, DOM4, HTML5, ECMAScript 6 and WAI-ARIA. <a href="/about/">Learn more &raquo;</a></p>
          <form aria-hidden="true">
            <p>Sign in with your <strong>bugzilla.mozilla.org</strong> user name (email) and API key. BzDeck works in the read-only mode if your key is not provided. <a href="https://bugzilla.mozilla.org/userprefs.cgi?tab=apikey">Get a key &raquo;</a></p>
            <p><input name="email" type="email" placeholder="User Name" required role="textbox" aria-label="User Name"><input name="apikey" type="text" maxlength="40" placeholder="API Key (optional)" pattern="^[A-Za-z0-9]{40}$" role="textbox" aria-label="API Key (optional)"><button role="button">Sign In</button></p>
          </form>
          <p role="status">This application requires <a href="https://www.mozilla.org/firefox/developer/">Firefox Developer Edition</a> or <a href="http://nightly.mozilla.org/">Firefox Nightly</a> with JavaScript enabled.</p>
        </div>
      </div>
    </section><!-- end #app-login -->
    <section id="app-body" aria-hidden="true">
      <header role="banner">
        <h1 role="button">BzDeck</h1>
        <div role="toolbar">
          <div id="quicksearch" title="Search for bugs" role="search">
            <input type="search" placeholder="Search for bugs" tabindex="1" role="searchbox" aria-haspopup="true" aria-owns="quicksearch-dropdown">
            <span tabindex="0" title="Search" role="button">Go</span>
            <ul id="quicksearch-dropdown" role="menu" aria-expanded="false"></ul>
          </div>
          <ul id="toolbar-buttons">
            <li role="none">
              <ul id="main-menu" role="menubar">
                <li role="none">
                  <span id="main-menu--app" title="Application Menu" role="menuitem" aria-haspopup="true" aria-owns="main-menu--app-menu"><label>App</label></span>
                  <ul id="main-menu--app-menu" role="menu" aria-expanded="false">
                    <li role="none">
                      <span id="main-menu--app--account" role="menuitem" aria-disabled="true"><label>My Account</label></span>
                    </li>
                    <li role="separator"></li>
                    <li role="none">
                      <span id="main-menu--app--profile" role="menuitem" data-command="show-profile"><label>Profile</label></span>
                    </li>
                    <li role="none">
                      <span id="main-menu--app--settings" role="menuitem" data-command="show-settings"><label>Settings</label></span>
                    </li>
                    <li role="none">
                      <span id="main-menu--app--fullscreen" role="menuitem" aria-hidden="true" data-command="toggle-fullscreen"><label>Enter Full Screen</label></span>
                    </li>
                    <li role="none">
                      <span id="main-menu--app--install" role="menuitem" aria-hidden="true" data-command="install-app"><label>Install as App</label></span>
                    </li>
                    <li role="separator"></li>
                    <li role="none">
                      <a id="main-menu--app--about" href="/about/" role="menuitem" data-command="show-about"><label>About BzDeck</label></a>
                    </li>
                    <li role="none">
                      <a id="main-menu--app--support" href="/support/" role="menuitem" data-command="show-support"><label>Support &amp; Feedback</label></a>
                    </li>
                    <li role="separator"></li>
                    <li role="none">
                      <span id="main-menu--app--logout" role="menuitem" data-command="logout"><label>Sign Out</label></span>
                    </li>
                    <li role="none">
                      <span id="main-menu--app--quit" role="menuitem" aria-hidden="true" data-command="quit"><label>Quit BzDeck</label></span>
                    </li>
                  </ul>
                </li>
              </ul>
            </li>
          </ul>
        </div>
      </header>
      <aside id="sidebar" tabindex="0" role="complementary">
        <div tabindex="0" role="region">
          <section id="sidebar-account">
            <h2>Account</h2>
          </section><!-- end #sidebar-account -->
          <section id="sidebar-folders">
            <h2>Bugs</h2>
            <ul id="sidebar-folder-list" role="listbox" tabindex="0" aria-multiselectable="false"></ul>
          </section><!-- end #sidebar-folders -->
          <section id="sidebar-menu">
            <h2>Menu</h2>
          </section><!-- end #sidebar-menu -->
        </div>
      </aside><!-- end #sidebar -->
      <main role="main">
        <ul id="main-tablist" tabindex="0" role="tablist" data-removable="true" data-reorderable="false">
          <li id="tab-home" title="Home" draggable="true" role="tab" aria-controls="tabpanel-home" aria-grabbed="false" aria-selected="true"><label>Home</label></li>
        </ul>
        <div id="main-tabpanels">
          <div id="tabpanel-home" tabindex="0" role="tabpanel" aria-hidden="false" aria-labelledby="tab-home">
            <section>
              <header>
                <div class="banner-nav-button" tabindex="0" role="button" aria-label="Menu"></div>
                <h2>Inbox</h2>
                <div role="toolbar"></div>
              </header>
              <div>
                <div id="home-list-pane" tabindex="0" role="region">
                  <section id="home-list" class="bug-list" role="grid" aria-labelledby="home-list-title" aria-multiselectable="true" aria-readonly="true" data-selection="rows">
                  </section>
                  <section id="home-vertical-thread" tabindex="0" role="region">
                    <ul tabindex="0" role="listbox" aria-multiselectable="true"></ul>
                  </section>
                  <footer aria-hidden="true">
                    <div role="status"><span>No bugs found in this folder.</span></div>
                  </footer>
                </div><!-- end #home-list-pane -->
                <div id="home-preview-splitter" class="splitter" draggable="true" tabindex="0" role="separator" aria-grabbed="false" aria-orientation="horizontal" aria-controls="home-list-pane home-preview-pane"></div>
                <div id="home-preview-pane" tabindex="0" role="region" aria-expanded="true"></div>
              </div>
            </section>
          </div><!-- end #tabpanel-home -->
        </div><!-- end #main-tabpanels -->
      </main>
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
      <meta itemprop="operatingSystem" content="Firefox OS">
      <meta itemprop="browserRequirements" content="Firefox Developer Edition">
      <meta itemprop="browserRequirements" content="Firefox Nightly">
    </div>
<?php include_once($_SERVER['DOCUMENT_ROOT'] . '/components/output-script-elements.inc.php'); ?>
  </body>
</html>
