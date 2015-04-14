# BzDeck

A useful experimental Bugzilla client demonstrating modern Web application technologies such as CSS3, DOM4, HTML5, ECMAScript 6 and WAI-ARIA.

* [BzDeck](https://www.bzdeck.com/)
* [Introducing BzDeck](https://www.bzdeck.com/about/)
* [BzDeck FAQ](https://www.bzdeck.com/faq/)
* [FlareTail.js](https://github.com/britegrid/flaretail.js) integrated as a submodule

## How to run the app locally

1. Fork this repository
2. Add a new virtual host in your Apache config:
  ```conf
  <VirtualHost *:80>
    ServerName local.bzdeck.com
    DocumentRoot "/path/to/bzdeck/webroot/"
  </VirtualHost>
  ```

3. Add a new host in your `/etc/hosts`: `127.0.0.1 local.bzdeck.com`
4. Restart your Apache server with PHP 5.4+ enabled
5. Open `http://local.bzdeck.com/` in your browser
