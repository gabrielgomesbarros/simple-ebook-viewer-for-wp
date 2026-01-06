export function transformDoc(data, type, ops) {
    try {
        let doc
        typeof data === 'string'
            ? doc = new DOMParser().parseFromString(data, type)
            : doc = data
        for (const [op, args] of ops.entries()) {
            switch (op) {
                case 'addCSPMeta':
                    addCSPMeta(doc)
                    break
                case 'removeInlineScripts':
                    removeInlineScripts(doc)
                    break
                case 'injectMathJax':
                    injectMathJax(doc, ...args)
                    break
            }
        }
        if (ops.has('convertFontSizePxToRem')) {
            const fontSize = ops.get('convertFontSizePxToRem')[0]
            doc.querySelectorAll('style')
                .forEach(s => s.textContent = convertFontSizePxToRem(
                    s.textContent, fontSize)
                )
        }
        return doc.documentElement.outerHTML
    }
    catch (e) { console.error(e) }
    return data
}

function addCSPMeta(doc) {
    const meta = doc.createElement('meta')
    meta.setAttribute('http-equiv', 'content-security-policy')
    meta.setAttribute('content', "script-src 'none'; script-src-attr 'none'; script-src-elem 'none'")
    meta.setAttribute('data-simebv-inject', 'true')
    doc.head ? doc.head.prepend(meta) : doc.documentElement.prepend(meta)
}

function removeInlineScripts(doc) {
    doc.querySelectorAll('script').forEach(el => el.replaceWith(doc.createElement('style')))
}

function injectMathJax(doc, url, config) {
    const scriptConfig = doc.createElement('script')
    scriptConfig.textContent = config
    const script = doc.createElement('script')
    script.setAttribute('defer', 'true')
    script.src = url
    doc.head
        ? doc.head.append(scriptConfig, script)
        : doc.documentElement.prepend(scriptConfig, script)
}

export function convertFontSizePxToRem(data, defaultSize) {
    return data.replace(
        /(?<=[{\s;])font-size:\s*([0-9]*\.?[0-9]+)px/gi,
        (match, p1, offset, string) => {
            const n = parseFloat(p1)
            return 'font-size:' + (Math.round((n / defaultSize) * 1000) / 1000) + 'rem'
        })
}


// CSS to inject in iframe of reflowable ebooks
export const getCSS = ({ spacing, justify, hyphenate, fontSize, colorScheme, bgColor, forcedColorScheme, fontFamily }) => `
    @namespace epub "http://www.idpf.org/2007/ops";
    :root {
        color-scheme: ${colorScheme} !important;
        font-size: ${fontSize}px;
        background-color: ${bgColor};
    }
    /* https://github.com/whatwg/html/issues/5426 */
    @media all and (prefers-color-scheme: dark) {
        a:link {
            color: ${colorScheme.includes('dark') ? 'lightblue' : 'LinkText'};
        }
        ${colorScheme.includes('dark')
          ? 'a:visited { color: VisitedText; }'
          : ''
        }
        ${!colorScheme.includes('dark')
            ? '[epub|type~="se:image.color-depth.black-on-transparent"] { filter: none !important; }'
            : ''
        }
    }
    ${forcedColorScheme.includes('dark')
        ? 'body, body * { color: #ffffff !important; background-color: ' + bgColor + ' !important; border-color: #ffffff !important; }'
        : ''
    }
    ${forcedColorScheme.includes('light')
        ? 'body, body * { color: #000000 !important; background-color: ' + bgColor + ' !important; border-color: #000000 !important; }'
        : ''
    }
    ${fontFamily !== 'auto'
        ? 'body, body * { font-family: ' + fontFamily + ' !important; }'
        : ''
    }
    p, li, blockquote, dd {
        line-height: ${spacing};
        text-align: ${justify ? 'justify' : 'start'};
        -webkit-hyphens: ${hyphenate ? 'auto' : 'manual'};
        hyphens: ${hyphenate ? 'auto' : 'manual'};
        -webkit-hyphenate-limit-before: 3;
        -webkit-hyphenate-limit-after: 2;
        -webkit-hyphenate-limit-lines: 2;
        hanging-punctuation: allow-end last;
        widows: 2;
    }
    /* prevent the above from overriding the align attribute */
    [align="left"] { text-align: left; }
    [align="right"] { text-align: right; }
    [align="center"] { text-align: center; }
    [align="justify"] { text-align: justify; }

    pre {
        white-space: pre-wrap !important;
    }
    aside[epub|type~="endnote"],
    aside[epub|type~="footnote"],
    aside[epub|type~="note"],
    aside[epub|type~="rearnote"] {
        display: none;
    }
    a:focus {
        text-decoration: underline dotted .1em;
    }
`
