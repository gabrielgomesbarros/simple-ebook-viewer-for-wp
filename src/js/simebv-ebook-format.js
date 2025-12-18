// All functions except ebookFormat are from vendor/foliate-js/view.js
const isZip = async file => {
    const arr = new Uint8Array(await file.slice(0, 4).arrayBuffer())
    return arr[0] === 0x50 && arr[1] === 0x4b && arr[2] === 0x03 && arr[3] === 0x04
}

const isPDF = async file => {
    const arr = new Uint8Array(await file.slice(0, 5).arrayBuffer())
    return arr[0] === 0x25
        && arr[1] === 0x50 && arr[2] === 0x44 && arr[3] === 0x46
        && arr[4] === 0x2d
}

const isCBZ = ({ name, type }) =>
    type === 'application/vnd.comicbook+zip' || name.endsWith('.cbz')

const isFB2 = ({ name, type }) =>
    type === 'application/x-fictionbook+xml' || name.endsWith('.fb2')

const isFBZ = ({ name, type }) =>
    type === 'application/x-zip-compressed-fb2'
    || name.endsWith('.fb2.zip') || name.endsWith('.fbz')


export const ebookFormat = async (ebook) => {
    if (isZip(ebook)) {
        if (isCBZ(ebook)) return 'cbz'
        else if (isFBZ(ebook)) return 'fb2'
        else return 'epub'
    }
    if (isFB2(ebook)) return 'fb2'
    if (isPDF(ebook)) return 'pdf'
    const { isMOBI } = await import('../../vendor/foliate-js/mobi.js')
    if (isMOBI(ebook)) return 'mobi'
    return 'unknown'
}
