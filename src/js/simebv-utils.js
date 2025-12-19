// https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API#testing_for_availability
export function storageAvailable(type) {
    let storage;
    try {
        storage = window[type];
        const x = "__storage_test__";
        storage.setItem(x, x);
        storage.removeItem(x);
        return true;
    } catch (e) {
        return (
            e instanceof DOMException &&
            e.name === "QuotaExceededError" &&
            // acknowledge QuotaExceededError only if there's something already stored
            storage &&
            storage.length !== 0
        );
    }
}


export function addCSPMeta(data, type) {
    try {
        let doc
        typeof data === 'string'
            ? doc = new DOMParser().parseFromString(data, type)
            : doc = data
        const meta = doc.createElement('meta')
        meta.setAttribute('http-equiv', 'content-security-policy')
        meta.setAttribute('content', "script-src 'none'; script-src-attr 'none'; script-src-elem 'none'")
        doc.head ? doc.head.prepend(meta) : doc.documentElement.prepend(meta)
        return doc.documentElement.outerHTML
    }
    catch (e) { console.error(e) }
    return data
}

export function removeInlineScripts(data, type) {
    try {
        let doc
        typeof data === 'string'
            ? doc = new DOMParser().parseFromString(data, type)
            : doc = data
        doc.querySelectorAll('script').forEach(el => el.remove())
        return doc.documentElement.outerHTML
    }
    catch (e) { console.error(e) }
    return data
}

export function injectMathJax(data, type, url, config) {
    try {
        let doc
        typeof data === 'string'
            ? doc = new DOMParser().parseFromString(data, type)
            : doc = data
        const scriptConfig = doc.createElement('script')
        scriptConfig.textContent = config
        const script = doc.createElement('script')
        script.setAttribute('defer', 'true')
        script.src = url
        doc.head
            ? doc.head.append(scriptConfig, script)
            : doc.documentElement.prepend(scriptConfig, script)
        return doc.documentElement.outerHTML
    }
    catch (e) { console.error(e) }
    return data
}

export function isNumeric(v) {
    return parseFloat(v) === Number(v)
}
