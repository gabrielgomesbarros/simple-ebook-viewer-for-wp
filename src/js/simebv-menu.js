export class Menu {
    #element
    #groups
    #currentItem
    #returnFocusTo
    #menuWalker

    constructor() {
        this.#groups = {}
        this.#element = document.createElement('ul')
        this.#element.setAttribute('role', 'menu')
        this.#element.addEventListener('click', (e) => e.stopPropagation())
        this.#menuWalker = document.createTreeWalker(this.#element, 1, { acceptNode: this.#acceptNode.bind(this) })
    }

    get element() {
        return this.#element
    }

    get groups() {
        return this.#groups
    }

    getMenuItems(root) {
        if (!root) {
            root = this.#element
        }
        return Array.from(root.querySelectorAll('[role^=menuitem]') || [])
    }

    show(returnFocus) {
        this.#element.classList.add('simebv-show')
        const firstMenuItem = this.#element.querySelector('[role^=menuitem]')
        firstMenuItem.tabIndex = 0
        firstMenuItem.focus()
        this.#currentItem = firstMenuItem
        if (returnFocus) {
            this.#returnFocusTo = returnFocus
        }
    }

    hide() {
        this.#element.classList.remove('simebv-show')
        if (this.#currentItem) {
            this.#currentItem.tabIndex = -1
        }
        if (this.#returnFocusTo) {
            this.#returnFocusTo.focus()
            this.#returnFocusTo = undefined
        }
        const e = new CustomEvent('closeMenu', { bubbles: true })
        this.#element.dispatchEvent(e)
    }

    #hideAnd(func) {
        return (...args) => (this.hide(), func(...args))
    }

    #updateFocus(current, next) {
        if (current) {
            current.tabIndex = -1
        }
        next.tabIndex = 0
        const subItem = next.querySelector('input')
        if (subItem) {
            subItem.focus()
        }
        else {
            next.focus()
        }
        this.#currentItem = next
    }

    addMenuItems(menuItems) {
        for (const item of menuItems) {
            this.addMenuItem(item)
        }
        this.#addKeyboardEventListeners()
    }

    addMenuItem(menuItem, addKeyboardEventListeners = false) {
        const { name, label, type, items, onclick, onvalidate, horizontal, shortcut, attrs } = menuItem
        let widget
        switch (type) {
            case 'radio':
                widget = this.#createMenuItemRadioGroup(label, items, onclick, onvalidate, horizontal)
                break
            case 'action':
                widget = this.#createActionMenuItem(label, shortcut, this.#hideAnd(onclick), undefined, attrs)
                break
            case 'group':
                widget = this.#createActionMenuGroup(label, items)
                break
            default:
                null
        }
        this.#groups[name] = widget
        const item = document.createElement('li')
        item.setAttribute('role', 'presentation')
        item.append(widget.element)
        this.#element.append(item)
        if (addKeyboardEventListeners) {
            this.#addKeyboardEventListeners(this.getMenuItems(widget))
        }
    }

    #isMenuItem(item) {
        return ['menuitem', 'menuitemradio', 'menuitemcheckbox'].includes(item.getAttribute('role'))
    }

    #isEnabled(item) {
        return !(
            item.getAttribute('disabled')
            || item.getAttribute('aria-disabled') === 'true'
            || item.parentElement.getAttribute('disabled')
            || item.parentElement.getAttribute('aria-disabled') === 'true'
        )
    }

    #isVisible(item) {
        let node = item
        while (node && node !== this.#element) {
            const style = globalThis.getComputedStyle(node)
            if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) {
                return false
            }
            node = node.parentElement
        }
        return true
    }

    #acceptNode(node) {
        return this.#isMenuItem(node) && this.#isVisible(node)
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_SKIP
    }

    #moveMenuWalkerTo(currentNode) {
        this.#menuWalker.currentNode = currentNode
    }

    #addKeyboardEventListeners(menuItems) {
        if (!menuItems) {
            menuItems = this.getMenuItems()
        }
        for (const item of menuItems) {
            if (item.simebv_listener_setup) {
                continue
            }
            item.addEventListener('keydown', event => {
                let stop = false
                const { currentTarget, key } = event
                switch (key) {
                    case ' ':
                    case 'Enter':
                        if (this.#isEnabled(currentTarget)) {
                            currentTarget.click()
                            stop = true
                        }
                        break
                    case 'ArrowDown': {
                        this.#moveMenuWalkerTo(currentTarget)
                        const next = this.#menuWalker.nextNode()
                        if (next) {
                            this.#updateFocus(currentTarget, next)
                        }
                        stop = true
                        break
                    }
                    case 'ArrowUp': {
                        this.#moveMenuWalkerTo(currentTarget)
                        const prev = this.#menuWalker.previousNode()
                        if (prev) {
                            this.#updateFocus(currentTarget, prev)
                        }
                        stop = true
                        break
                    }
                    case 'ArrowLeft': {
                        this.#moveMenuWalkerTo(currentTarget)
                        const prev = this.#menuWalker.previousNode()
                        if (prev && currentTarget.parentElement.classList.contains('simebv-horizontal')
                                && currentTarget.parentElement === currentTarget.previousSibling?.parentElement) {
                            this.#updateFocus(currentTarget, prev)
                        }
                        stop = true
                        break
                    }
                    case 'ArrowRight': {
                        this.#moveMenuWalkerTo(currentTarget)
                        const next = this.#menuWalker.nextNode()
                        if (next && currentTarget.parentElement.classList.contains('simebv-horizontal')
                                && currentTarget.parentElement === currentTarget.nextSibling?.parentElement) {
                            this.#updateFocus(currentTarget, next)
                        }
                        stop = true
                        break
                    }
                    case 'Home': {
                        this.#moveMenuWalkerTo(currentTarget)
                        let target = this.#menuWalker.previousNode()
                        while (target) {
                            let prev = this.#menuWalker.previousNode()
                            if (!prev) {
                                break
                            }
                            target = prev
                        }
                        if (target) this.#updateFocus(currentTarget, target)
                        stop = true
                        break
                    }
                    case 'End': {
                        this.#moveMenuWalkerTo(currentTarget)
                        let target = this.#menuWalker.nextNode()
                        while (target) {
                            let next = this.#menuWalker.nextNode()
                            if (!next) {
                                break
                            }
                            target = next
                        }
                        if (target) this.#updateFocus(currentTarget, target)
                        stop = true
                        break
                    }
                }
                if (stop) {
                    event.preventDefault()
                    event.stopPropagation()
                }
            })
            item.simebv_listener_setup = true
        }
    }

    #createMenuItemRadioGroup(label, items, onclick, onvalidate, horizontal) {
        const container = document.createElement('fieldset')
        const header = document.createElement('legend')
        header.innerText = label
        const group = document.createElement('ul')
        group.setAttribute('role', 'presentation')
        if (horizontal) {
            group.classList.add('simebv-horizontal')
        }
        const map = new Map()
        let currentValue
        const current = () => currentValue
        const select = value => {
            if (container.getAttribute('aria-disabled') === 'true') return
            currentValue = value
            const item = map.get(value)
            for (const child of group.children)
                child.setAttribute('aria-checked', child === item ? 'true' : 'false')
            onclick(value)
        }
        const enable = (activate) => {
            activate === false
                ? container.setAttribute('aria-disabled', 'true')
                : container.removeAttribute('aria-disabled')
        }
        const visible = (isVisible) => {
            isVisible === false
                ? container.style.display = 'none'
                : container.style.display = null
        }
        const acceptedValues = []
        const validate = onvalidate ?? ((value) => acceptedValues.includes(value))
        for (const [label, value] of items) {
            const item = document.createElement('li')
            item.setAttribute('role', 'menuitemradio')
            item.innerText = label
            let v
            if (typeof value === 'string' || typeof value === 'number') {
                v = value
            }
            else {
                const { val, type, attrs, onchange, prefix = '', suffix = '', labelID } = value
                const containerInput = document.createElement('span')
                if (attrs.id)
                    containerInput.id = attrs.id + '-container'
                const input = document.createElement('input')
                input.type = type
                for (const [attr, val] of Object.entries(attrs)) {
                    input.setAttribute(attr, val)
                }
                input.onchange = onchange
                if (labelID) {
                    item.id = labelID
                    input.setAttribute('aria-labelledby', labelID)
                }
                containerInput.append(prefix, input, suffix)
                item.append(containerInput)
                v = val
            }
            item.onclick = () => {
                select(v)
                this.#updateFocus(this.#currentItem, item)
            }
            item.onkeydown = (e) => { if (e.key === ' ') select(v) }
            map.set(v, item)
            acceptedValues.push(v)
            group.append(item)
        }
        container.append(header, group)
        return { element: container, select, enable, validate, current, visible }
    }

    #createActionMenuItem(label, shortcut, onclick, container, attrs, ...args) {
        const p = document.createElement('p')
        p.innerText = label
        p.setAttribute('role', 'menuitem')
        if (attrs) {
            for (const [attr, value] of attrs) {
                p.setAttribute(attr, value)
            }
        }
        p.onclick = () => {
            onclick(...args)
            this.#updateFocus(this.#currentItem, p)
        }
        if (!container) {
            container = document.createElement('fieldset')
            container.append(p)
        }
        if (shortcut) {
            const s = document.createElement('span')
            s.innerText = shortcut
            s.classList.add('simebv-menu-shortcut')
            p.append(s)
        }
        const enable = (activate) => {
            activate === false
                ? container.setAttribute('aria-disabled', 'true')
                : container.removeAttribute('aria-disabled')
        }
        const visible = (isVisible) => {
            isVisible === false
                ? container.style.display = 'none'
                : container.style.display = null
        }
        return { element: container, enable, visible }
    }

    #createActionMenuGroup(label, items) {
        const container = document.createElement('fieldset')
        const menuGroup = { element: container, items: {} }
        const header = document.createElement('legend')
        header.innerText = label
        const group = document.createElement('ul')
        group.setAttribute('role', 'presentation')
        container.append(header, group)
        for (const item of items) {
            const listItem = document.createElement('li')
            listItem.setAttribute('role', 'menuitem')
            listItem.innerText = item.label
            if (item.classList) {
                listItem.classList.add(...item.classList)
            }
            listItem.onclick = () => {
                item.onclick()
                this.#updateFocus(this.#currentItem, item)
            }
            const select = () => listItem.click()
            const enable = (active) => {
                active === false
                    ? listItem.setAttribute('aria-disabled', 'true')
                    : listItem.removeAttribute('aria-disabled')
            }
            menuGroup.items[item.name] = {
                element: listItem, select, enable
            }
            group.append(listItem)
        }

        menuGroup.enable = (activate) => {
            activate === false
                ? container.setAttribute('aria-disabled', 'true')
                : container.removeAttribute('aria-disabled')
        }

        menuGroup.visible = (isVisible) => {
            isVisible === false
                ? container.style.display = 'none'
                : container.style.display = null
        }

        return menuGroup
    }

}
