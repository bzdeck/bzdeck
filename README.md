# BzDeck

A useful experimental Bugzilla client demonstrating modern Web application technologies such as CSS3, DOM4, HTML5, ECMAScript 6 and WAI-ARIA.

* [BzDeck](https://www.bzdeck.com/)
* [Introducing BzDeck](https://www.bzdeck.com/about/)
* [BzDeck FAQ](https://www.bzdeck.com/faq/)
* [FlareTail.js](https://github.com/kyoshino/flaretail.js)

## How to run the app locally

1. Fork this repository, [flaretail.js](https://github.com/kyoshino/flaretail.js) and [JavaScript-MD5](https://github.com/blueimp/JavaScript-MD5)
2. Copy or symlink 3 JavaScript files from flaretail.js to `/webroot/static/scripts/lib/flaretail/`
3. Copy or symlink `md5.min.js` from JavaScript-MD5 to `/webroot/static/scripts/lib/crypto/`
4. Copy or symlink `widget.css` from flaretail.js to `/webroot/static/styles/lib/flaretail/`
5. Add a new virtual host in your Apache config:
  ```conf
  <VirtualHost *:80>
    ServerName local.bzdeck.com
    DocumentRoot "/path/to/bzdeck/directory/"
  </VirtualHost>
  ```

6. Restart your Apache server
7. Open `http://local.bzdeck.com/` in your browser
