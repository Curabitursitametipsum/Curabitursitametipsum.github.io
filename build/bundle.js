
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    const identity = x => x;
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    let src_url_equal_anchor;
    function src_url_equal(element_src, url) {
        if (!src_url_equal_anchor) {
            src_url_equal_anchor = document.createElement('a');
        }
        src_url_equal_anchor.href = url;
        return element_src === src_url_equal_anchor.href;
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

    const tasks = new Set();
    function run_tasks(now) {
        tasks.forEach(task => {
            if (!task.c(now)) {
                tasks.delete(task);
                task.f();
            }
        });
        if (tasks.size !== 0)
            raf(run_tasks);
    }
    /**
     * Creates a new task that runs on each raf frame
     * until it returns a falsy value or is aborted
     */
    function loop(callback) {
        let task;
        if (tasks.size === 0)
            raf(run_tasks);
        return {
            promise: new Promise(fulfill => {
                tasks.add(task = { c: callback, f: fulfill });
            }),
            abort() {
                tasks.delete(task);
            }
        };
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function get_root_for_style(node) {
        if (!node)
            return document;
        const root = node.getRootNode ? node.getRootNode() : node.ownerDocument;
        if (root && root.host) {
            return root;
        }
        return node.ownerDocument;
    }
    function append_empty_stylesheet(node) {
        const style_element = element('style');
        append_stylesheet(get_root_for_style(node), style_element);
        return style_element;
    }
    function append_stylesheet(node, style) {
        append(node.head || node, style);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function custom_event(type, detail, bubbles = false) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, false, detail);
        return e;
    }

    const active_docs = new Set();
    let active = 0;
    // https://github.com/darkskyapp/string-hash/blob/master/index.js
    function hash(str) {
        let hash = 5381;
        let i = str.length;
        while (i--)
            hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
        return hash >>> 0;
    }
    function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
        const step = 16.666 / duration;
        let keyframes = '{\n';
        for (let p = 0; p <= 1; p += step) {
            const t = a + (b - a) * ease(p);
            keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
        }
        const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
        const name = `__svelte_${hash(rule)}_${uid}`;
        const doc = get_root_for_style(node);
        active_docs.add(doc);
        const stylesheet = doc.__svelte_stylesheet || (doc.__svelte_stylesheet = append_empty_stylesheet(node).sheet);
        const current_rules = doc.__svelte_rules || (doc.__svelte_rules = {});
        if (!current_rules[name]) {
            current_rules[name] = true;
            stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
        }
        const animation = node.style.animation || '';
        node.style.animation = `${animation ? `${animation}, ` : ''}${name} ${duration}ms linear ${delay}ms 1 both`;
        active += 1;
        return name;
    }
    function delete_rule(node, name) {
        const previous = (node.style.animation || '').split(', ');
        const next = previous.filter(name
            ? anim => anim.indexOf(name) < 0 // remove specific animation
            : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
        );
        const deleted = previous.length - next.length;
        if (deleted) {
            node.style.animation = next.join(', ');
            active -= deleted;
            if (!active)
                clear_rules();
        }
    }
    function clear_rules() {
        raf(() => {
            if (active)
                return;
            active_docs.forEach(doc => {
                const stylesheet = doc.__svelte_stylesheet;
                let i = stylesheet.cssRules.length;
                while (i--)
                    stylesheet.deleteRule(i);
                doc.__svelte_rules = {};
            });
            active_docs.clear();
        });
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }

    let promise;
    function wait() {
        if (!promise) {
            promise = Promise.resolve();
            promise.then(() => {
                promise = null;
            });
        }
        return promise;
    }
    function dispatch(node, direction, kind) {
        node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    const null_transition = { duration: 0 };
    function create_bidirectional_transition(node, fn, params, intro) {
        let config = fn(node, params);
        let t = intro ? 0 : 1;
        let running_program = null;
        let pending_program = null;
        let animation_name = null;
        function clear_animation() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function init(program, duration) {
            const d = (program.b - t);
            duration *= Math.abs(d);
            return {
                a: t,
                b: program.b,
                d,
                duration,
                start: program.start,
                end: program.start + duration,
                group: program.group
            };
        }
        function go(b) {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            const program = {
                start: now() + delay,
                b
            };
            if (!b) {
                // @ts-ignore todo: improve typings
                program.group = outros;
                outros.r += 1;
            }
            if (running_program || pending_program) {
                pending_program = program;
            }
            else {
                // if this is an intro, and there's a delay, we need to do
                // an initial tick and/or apply CSS animation immediately
                if (css) {
                    clear_animation();
                    animation_name = create_rule(node, t, b, duration, delay, easing, css);
                }
                if (b)
                    tick(0, 1);
                running_program = init(program, duration);
                add_render_callback(() => dispatch(node, b, 'start'));
                loop(now => {
                    if (pending_program && now > pending_program.start) {
                        running_program = init(pending_program, duration);
                        pending_program = null;
                        dispatch(node, running_program.b, 'start');
                        if (css) {
                            clear_animation();
                            animation_name = create_rule(node, t, running_program.b, running_program.duration, 0, easing, config.css);
                        }
                    }
                    if (running_program) {
                        if (now >= running_program.end) {
                            tick(t = running_program.b, 1 - t);
                            dispatch(node, running_program.b, 'end');
                            if (!pending_program) {
                                // we're done
                                if (running_program.b) {
                                    // intro — we can tidy up immediately
                                    clear_animation();
                                }
                                else {
                                    // outro — needs to be coordinated
                                    if (!--running_program.group.r)
                                        run_all(running_program.group.c);
                                }
                            }
                            running_program = null;
                        }
                        else if (now >= running_program.start) {
                            const p = now - running_program.start;
                            t = running_program.a + running_program.d * easing(p / running_program.duration);
                            tick(t, 1 - t);
                        }
                    }
                    return !!(running_program || pending_program);
                });
            }
        }
        return {
            run(b) {
                if (is_function(config)) {
                    wait().then(() => {
                        // @ts-ignore
                        config = config();
                        go(b);
                    });
                }
                else {
                    go(b);
                }
            },
            end() {
                clear_animation();
                running_program = pending_program = null;
            }
        };
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.44.0' }, detail), true));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    function cubicOut(t) {
        const f = t - 1.0;
        return f * f * f + 1.0;
    }

    function fly(node, { delay = 0, duration = 400, easing = cubicOut, x = 0, y = 0, opacity = 0 } = {}) {
        const style = getComputedStyle(node);
        const target_opacity = +style.opacity;
        const transform = style.transform === 'none' ? '' : style.transform;
        const od = target_opacity * (1 - opacity);
        return {
            delay,
            duration,
            easing,
            css: (t, u) => `
			transform: ${transform} translate(${(1 - t) * x}px, ${(1 - t) * y}px);
			opacity: ${target_opacity - (od * u)}`
        };
    }

    /* src\App.svelte generated by Svelte v3.44.0 */
    const file = "src\\App.svelte";

    // (26:3) {#if visible}
    function create_if_block_2(ctx) {
    	let p;
    	let p_transition;
    	let t1;
    	let img;
    	let img_src_value;
    	let current;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "I study at Supisorn Kindergarten. Until the end of kindergarten 3. As a child, I lived with my grandmother. And this school is near Grandma's house. made me go to this school At that time, when I was studying in Supisorn Kindergarten, I received the warmth from the teachers there that made me grow up happy.";
    			t1 = space();
    			img = element("img");
    			add_location(p, file, 26, 4, 1020);
    			if (!src_url_equal(img.src, img_src_value = "image/school/s1.jpg")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "");
    			attr_dev(img, "width", "900");
    			add_location(img, file, 27, 4, 1386);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, img, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!p_transition) p_transition = create_bidirectional_transition(p, fly, { y: 200, duration: 2000 }, true);
    				p_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (!p_transition) p_transition = create_bidirectional_transition(p, fly, { y: 200, duration: 2000 }, false);
    			p_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    			if (detaching && p_transition) p_transition.end();
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(26:3) {#if visible}",
    		ctx
    	});

    	return block;
    }

    // (35:3) {#if visible}
    function create_if_block_1(ctx) {
    	let p;
    	let p_transition;
    	let t1;
    	let img;
    	let img_src_value;
    	let current;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "I studied at Patai Udom Suksa School from grade 1 to grade 6. At that time I was in Gifted program and had received a certificate for good studies. But I'm not very happy to study at this school because the school is very stressful about academics.";
    			t1 = space();
    			img = element("img");
    			add_location(p, file, 35, 4, 1601);
    			if (!src_url_equal(img.src, img_src_value = "image/school/s2.jpg")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "");
    			attr_dev(img, "width", "900");
    			add_location(img, file, 36, 4, 1907);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, img, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!p_transition) p_transition = create_bidirectional_transition(p, fly, { y: 200, duration: 2000 }, true);
    				p_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (!p_transition) p_transition = create_bidirectional_transition(p, fly, { y: 200, duration: 2000 }, false);
    			p_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    			if (detaching && p_transition) p_transition.end();
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(35:3) {#if visible}",
    		ctx
    	});

    	return block;
    }

    // (44:3) {#if visible}
    function create_if_block(ctx) {
    	let p;
    	let p_transition;
    	let t1;
    	let img;
    	let img_src_value;
    	let current;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "After my parents saw that I wasn't happy at Patai Udom Suksa School. Therefore, it was suggested that I move to Tripat School instead because Triphat School is a waldorf School. that doesn't focus on academic matters much, but focuses more emphasis on activities which I have studied at this school until now";
    			t1 = space();
    			img = element("img");
    			add_location(p, file, 44, 4, 2112);
    			if (!src_url_equal(img.src, img_src_value = "image/school/s3.jpg")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "");
    			attr_dev(img, "width", "900");
    			add_location(img, file, 45, 4, 2478);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, img, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!p_transition) p_transition = create_bidirectional_transition(p, fly, { y: 200, duration: 2000 }, true);
    				p_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (!p_transition) p_transition = create_bidirectional_transition(p, fly, { y: 200, duration: 2000 }, false);
    			p_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    			if (detaching && p_transition) p_transition.end();
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(44:3) {#if visible}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let div9;
    	let div1;
    	let div0;
    	let h10;
    	let t0;
    	let t1_value = (/*name*/ ctx[0] || 'Teacher') + "";
    	let t1;
    	let t2;
    	let t3;
    	let input0;
    	let t4;
    	let h50;
    	let t6;
    	let hr0;
    	let t7;
    	let div6;
    	let div2;
    	let h11;
    	let t9;
    	let h40;
    	let t11;
    	let br0;
    	let br1;
    	let t12;
    	let img0;
    	let img0_src_value;
    	let t13;
    	let h51;
    	let div3;
    	let label0;
    	let input1;
    	let t14;
    	let t15;
    	let t16;
    	let div4;
    	let label1;
    	let input2;
    	let t17;
    	let t18;
    	let t19;
    	let div5;
    	let label2;
    	let input3;
    	let t20;
    	let t21;
    	let t22;
    	let div7;
    	let h12;
    	let t24;
    	let h52;
    	let t25;
    	let br2;
    	let t26;
    	let hr1;
    	let t27;
    	let br3;
    	let t28;
    	let i;
    	let li0;
    	let t30;
    	let li1;
    	let t32;
    	let li2;
    	let t34;
    	let li3;
    	let t36;
    	let img1;
    	let img1_src_value;
    	let t37;
    	let img2;
    	let img2_src_value;
    	let t38;
    	let img3;
    	let img3_src_value;
    	let t39;
    	let img4;
    	let img4_src_value;
    	let t40;
    	let br4;
    	let t41;
    	let h13;
    	let t43;
    	let div8;
    	let h14;
    	let t45;
    	let hr2;
    	let t46;
    	let h41;
    	let t48;
    	let img5;
    	let img5_src_value;
    	let t49;
    	let h20;
    	let t51;
    	let h53;
    	let t52;
    	let br5;
    	let t53;
    	let br6;
    	let t54;
    	let t55;
    	let img6;
    	let img6_src_value;
    	let t56;
    	let h21;
    	let t58;
    	let h54;
    	let current;
    	let mounted;
    	let dispose;
    	let if_block0 = /*visible*/ ctx[1] && create_if_block_2(ctx);
    	let if_block1 = /*visible*/ ctx[1] && create_if_block_1(ctx);
    	let if_block2 = /*visible*/ ctx[1] && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			div9 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			h10 = element("h1");
    			t0 = text("Hello ");
    			t1 = text(t1_value);
    			t2 = text("!");
    			t3 = space();
    			input0 = element("input");
    			t4 = space();
    			h50 = element("h5");
    			h50.textContent = "This website is part of the It subject.The purpose is for students to learn about the use of html to write a website introducing yourself.This site tells a story about my profile. by collecting various stories related to me, education, family and preferences, hope you enjoy it.";
    			t6 = space();
    			hr0 = element("hr");
    			t7 = space();
    			div6 = element("div");
    			div2 = element("div");
    			h11 = element("h1");
    			h11.textContent = "Education";
    			t9 = space();
    			h40 = element("h4");
    			h40.textContent = "The various educational establishments I have studied and during the time.";
    			t11 = space();
    			br0 = element("br");
    			br1 = element("br");
    			t12 = space();
    			img0 = element("img");
    			t13 = space();
    			h51 = element("h5");
    			div3 = element("div");
    			label0 = element("label");
    			input1 = element("input");
    			t14 = text(" Supisorn Kindergarten");
    			t15 = space();
    			if (if_block0) if_block0.c();
    			t16 = space();
    			div4 = element("div");
    			label1 = element("label");
    			input2 = element("input");
    			t17 = text(" Patai Udom Suksa School");
    			t18 = space();
    			if (if_block1) if_block1.c();
    			t19 = space();
    			div5 = element("div");
    			label2 = element("label");
    			input3 = element("input");
    			t20 = text(" Tripat School");
    			t21 = space();
    			if (if_block2) if_block2.c();
    			t22 = space();
    			div7 = element("div");
    			h12 = element("h1");
    			h12.textContent = "Preference";
    			t24 = space();
    			h52 = element("h5");
    			t25 = text("Most of my preference is probably about watching movies because of watching movies. made me see people Quaint place without going out and here is my list of favorite movies. ");
    			br2 = element("br");
    			t26 = space();
    			hr1 = element("hr");
    			t27 = space();
    			br3 = element("br");
    			t28 = space();
    			i = element("i");
    			li0 = element("li");
    			li0.textContent = "Pirates of the Caribbean";
    			t30 = space();
    			li1 = element("li");
    			li1.textContent = "Avengers";
    			t32 = space();
    			li2 = element("li");
    			li2.textContent = "John wick";
    			t34 = space();
    			li3 = element("li");
    			li3.textContent = "Hannibal";
    			t36 = space();
    			img1 = element("img");
    			t37 = space();
    			img2 = element("img");
    			t38 = space();
    			img3 = element("img");
    			t39 = space();
    			img4 = element("img");
    			t40 = space();
    			br4 = element("br");
    			t41 = space();
    			h13 = element("h1");
    			h13.textContent = "-----------";
    			t43 = space();
    			div8 = element("div");
    			h14 = element("h1");
    			h14.textContent = "Ways to contact Kanyanut";
    			t45 = space();
    			hr2 = element("hr");
    			t46 = space();
    			h41 = element("h4");
    			h41.textContent = "Would you like to know me better? You will be able to contact me through the following channels. Let's get to know me !";
    			t48 = space();
    			img5 = element("img");
    			t49 = space();
    			h20 = element("h2");
    			h20.textContent = "Find me here";
    			t51 = space();
    			h53 = element("h5");
    			t52 = text("7/246 Chaiyapruek Watcharapol ");
    			br5 = element("br");
    			t53 = text("Ramintra Tharang Bangkhen ");
    			br6 = element("br");
    			t54 = text(" 10220 THA");
    			t55 = space();
    			img6 = element("img");
    			t56 = space();
    			h21 = element("h2");
    			h21.textContent = "Say hello";
    			t58 = space();
    			h54 = element("h5");
    			h54.textContent = "kanyanut.p@tripatschool.ac.th";
    			attr_dev(h10, "class", "svelte-1br3oi8");
    			add_location(h10, file, 8, 2, 197);
    			attr_dev(input0, "placeholder", "enter your name");
    			attr_dev(input0, "class", "svelte-1br3oi8");
    			add_location(input0, file, 9, 2, 235);
    			attr_dev(div0, "class", "transbox svelte-1br3oi8");
    			add_location(div0, file, 7, 1, 172);
    			attr_dev(h50, "class", "svelte-1br3oi8");
    			add_location(h50, file, 11, 2, 301);
    			add_location(hr0, file, 11, 290, 589);
    			attr_dev(div1, "class", "Home svelte-1br3oi8");
    			set_style(div1, "background-image", "url(image/room.jpg)");
    			add_location(div1, file, 6, 0, 104);
    			attr_dev(h11, "class", "svelte-1br3oi8");
    			add_location(h11, file, 16, 2, 654);
    			attr_dev(div2, "class", "transbox1 svelte-1br3oi8");
    			add_location(div2, file, 15, 1, 628);
    			attr_dev(h40, "class", "svelte-1br3oi8");
    			add_location(h40, file, 18, 1, 682);
    			add_location(br0, file, 18, 85, 766);
    			add_location(br1, file, 18, 89, 770);
    			if (!src_url_equal(img0.src, img0_src_value = "https://cdn-icons-png.flaticon.com/512/5845/5845699.png")) attr_dev(img0, "src", img0_src_value);
    			attr_dev(img0, "alt", "");
    			attr_dev(img0, "width", "300");
    			add_location(img0, file, 19, 1, 776);
    			attr_dev(input1, "type", "checkbox");
    			attr_dev(input1, "class", "svelte-1br3oi8");
    			add_location(input1, file, 22, 4, 908);
    			add_location(label0, file, 21, 3, 896);
    			attr_dev(div3, "class", "transbox1 svelte-1br3oi8");
    			add_location(div3, file, 20, 6, 869);
    			attr_dev(input2, "type", "checkbox");
    			attr_dev(input2, "class", "svelte-1br3oi8");
    			add_location(input2, file, 31, 4, 1487);
    			add_location(label1, file, 30, 3, 1475);
    			attr_dev(div4, "class", "transbox1 svelte-1br3oi8");
    			add_location(div4, file, 29, 2, 1448);
    			attr_dev(input3, "type", "checkbox");
    			attr_dev(input3, "class", "svelte-1br3oi8");
    			add_location(input3, file, 40, 4, 2008);
    			add_location(label2, file, 39, 3, 1996);
    			attr_dev(div5, "class", "transbox1 svelte-1br3oi8");
    			add_location(div5, file, 38, 2, 1969);
    			attr_dev(h51, "class", "svelte-1br3oi8");
    			add_location(h51, file, 20, 2, 865);
    			attr_dev(div6, "class", "Education svelte-1br3oi8");
    			add_location(div6, file, 14, 0, 603);
    			attr_dev(h12, "class", "svelte-1br3oi8");
    			add_location(h12, file, 50, 1, 2576);
    			attr_dev(div7, "class", "transbox2 svelte-1br3oi8");
    			add_location(div7, file, 49, 0, 2551);
    			add_location(br2, file, 52, 178, 2781);
    			add_location(hr1, file, 52, 183, 2786);
    			add_location(br3, file, 52, 188, 2791);
    			add_location(li0, file, 53, 4, 2800);
    			add_location(li1, file, 54, 1, 2836);
    			add_location(li2, file, 55, 1, 2856);
    			add_location(li3, file, 56, 1, 2877);
    			add_location(i, file, 53, 1, 2797);
    			attr_dev(h52, "class", "svelte-1br3oi8");
    			add_location(h52, file, 52, 0, 2603);
    			if (!src_url_equal(img1.src, img1_src_value = "image/movies/Pirates.jpg")) attr_dev(img1, "src", img1_src_value);
    			attr_dev(img1, "alt", "");
    			attr_dev(img1, "width", "300");
    			add_location(img1, file, 58, 1, 2908);
    			if (!src_url_equal(img2.src, img2_src_value = "image/movies/Avengers.jpg")) attr_dev(img2, "src", img2_src_value);
    			attr_dev(img2, "alt", "");
    			attr_dev(img2, "width", "300");
    			add_location(img2, file, 59, 1, 2966);
    			if (!src_url_equal(img3.src, img3_src_value = "image/movies/John Wick.png")) attr_dev(img3, "src", img3_src_value);
    			attr_dev(img3, "alt", "");
    			attr_dev(img3, "width", "300");
    			add_location(img3, file, 60, 1, 3024);
    			if (!src_url_equal(img4.src, img4_src_value = "image/movies/Hannibal.jpg")) attr_dev(img4, "src", img4_src_value);
    			attr_dev(img4, "alt", "");
    			attr_dev(img4, "width", "300");
    			add_location(img4, file, 61, 1, 3083);
    			add_location(br4, file, 61, 58, 3140);
    			attr_dev(h13, "class", "svelte-1br3oi8");
    			add_location(h13, file, 62, 1, 3146);
    			attr_dev(h14, "class", "svelte-1br3oi8");
    			add_location(h14, file, 66, 1, 3194);
    			add_location(hr2, file, 66, 35, 3228);
    			attr_dev(h41, "class", "svelte-1br3oi8");
    			add_location(h41, file, 67, 1, 3235);
    			if (!src_url_equal(img5.src, img5_src_value = "https://cdn-icons-png.flaticon.com/512/4643/4643972.png")) attr_dev(img5, "src", img5_src_value);
    			attr_dev(img5, "alt", "");
    			attr_dev(img5, "width", "80");
    			add_location(img5, file, 68, 1, 3365);
    			attr_dev(h20, "class", "svelte-1br3oi8");
    			add_location(h20, file, 69, 1, 3452);
    			add_location(br5, file, 70, 38, 3512);
    			add_location(br6, file, 70, 68, 3542);
    			attr_dev(h53, "class", "svelte-1br3oi8");
    			add_location(h53, file, 70, 4, 3478);
    			if (!src_url_equal(img6.src, img6_src_value = "https://cdn-icons-png.flaticon.com/512/3781/3781615.png")) attr_dev(img6, "src", img6_src_value);
    			attr_dev(img6, "alt", "");
    			attr_dev(img6, "width", "80");
    			add_location(img6, file, 71, 1, 3563);
    			attr_dev(h21, "class", "svelte-1br3oi8");
    			add_location(h21, file, 72, 1, 3650);
    			attr_dev(h54, "class", "svelte-1br3oi8");
    			add_location(h54, file, 73, 1, 3670);
    			attr_dev(div8, "class", "transbox3 svelte-1br3oi8");
    			add_location(div8, file, 65, 0, 3169);
    			attr_dev(div9, "class", "svelte-1br3oi8");
    			add_location(div9, file, 5, 0, 98);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div9, anchor);
    			append_dev(div9, div1);
    			append_dev(div1, div0);
    			append_dev(div0, h10);
    			append_dev(h10, t0);
    			append_dev(h10, t1);
    			append_dev(h10, t2);
    			append_dev(div0, t3);
    			append_dev(div0, input0);
    			set_input_value(input0, /*name*/ ctx[0]);
    			append_dev(div1, t4);
    			append_dev(div1, h50);
    			append_dev(div1, t6);
    			append_dev(div1, hr0);
    			append_dev(div9, t7);
    			append_dev(div9, div6);
    			append_dev(div6, div2);
    			append_dev(div2, h11);
    			append_dev(div6, t9);
    			append_dev(div6, h40);
    			append_dev(div6, t11);
    			append_dev(div6, br0);
    			append_dev(div6, br1);
    			append_dev(div6, t12);
    			append_dev(div6, img0);
    			append_dev(div6, t13);
    			append_dev(div6, h51);
    			append_dev(h51, div3);
    			append_dev(div3, label0);
    			append_dev(label0, input1);
    			input1.checked = /*visible*/ ctx[1];
    			append_dev(label0, t14);
    			append_dev(h51, t15);
    			if (if_block0) if_block0.m(h51, null);
    			append_dev(h51, t16);
    			append_dev(h51, div4);
    			append_dev(div4, label1);
    			append_dev(label1, input2);
    			input2.checked = /*visible*/ ctx[1];
    			append_dev(label1, t17);
    			append_dev(h51, t18);
    			if (if_block1) if_block1.m(h51, null);
    			append_dev(h51, t19);
    			append_dev(h51, div5);
    			append_dev(div5, label2);
    			append_dev(label2, input3);
    			input3.checked = /*visible*/ ctx[1];
    			append_dev(label2, t20);
    			append_dev(h51, t21);
    			if (if_block2) if_block2.m(h51, null);
    			append_dev(div9, t22);
    			append_dev(div9, div7);
    			append_dev(div7, h12);
    			append_dev(div9, t24);
    			append_dev(div9, h52);
    			append_dev(h52, t25);
    			append_dev(h52, br2);
    			append_dev(h52, t26);
    			append_dev(h52, hr1);
    			append_dev(h52, t27);
    			append_dev(h52, br3);
    			append_dev(h52, t28);
    			append_dev(h52, i);
    			append_dev(i, li0);
    			append_dev(i, t30);
    			append_dev(i, li1);
    			append_dev(i, t32);
    			append_dev(i, li2);
    			append_dev(i, t34);
    			append_dev(i, li3);
    			append_dev(div9, t36);
    			append_dev(div9, img1);
    			append_dev(div9, t37);
    			append_dev(div9, img2);
    			append_dev(div9, t38);
    			append_dev(div9, img3);
    			append_dev(div9, t39);
    			append_dev(div9, img4);
    			append_dev(div9, t40);
    			append_dev(div9, br4);
    			append_dev(div9, t41);
    			append_dev(div9, h13);
    			append_dev(div9, t43);
    			append_dev(div9, div8);
    			append_dev(div8, h14);
    			append_dev(div8, t45);
    			append_dev(div8, hr2);
    			append_dev(div8, t46);
    			append_dev(div8, h41);
    			append_dev(div8, t48);
    			append_dev(div8, img5);
    			append_dev(div8, t49);
    			append_dev(div8, h20);
    			append_dev(div8, t51);
    			append_dev(div8, h53);
    			append_dev(h53, t52);
    			append_dev(h53, br5);
    			append_dev(h53, t53);
    			append_dev(h53, br6);
    			append_dev(h53, t54);
    			append_dev(div8, t55);
    			append_dev(div8, img6);
    			append_dev(div8, t56);
    			append_dev(div8, h21);
    			append_dev(div8, t58);
    			append_dev(div8, h54);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[2]),
    					listen_dev(input1, "change", /*input1_change_handler*/ ctx[3]),
    					listen_dev(input2, "change", /*input2_change_handler*/ ctx[4]),
    					listen_dev(input3, "change", /*input3_change_handler*/ ctx[5])
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if ((!current || dirty & /*name*/ 1) && t1_value !== (t1_value = (/*name*/ ctx[0] || 'Teacher') + "")) set_data_dev(t1, t1_value);

    			if (dirty & /*name*/ 1 && input0.value !== /*name*/ ctx[0]) {
    				set_input_value(input0, /*name*/ ctx[0]);
    			}

    			if (dirty & /*visible*/ 2) {
    				input1.checked = /*visible*/ ctx[1];
    			}

    			if (/*visible*/ ctx[1]) {
    				if (if_block0) {
    					if (dirty & /*visible*/ 2) {
    						transition_in(if_block0, 1);
    					}
    				} else {
    					if_block0 = create_if_block_2(ctx);
    					if_block0.c();
    					transition_in(if_block0, 1);
    					if_block0.m(h51, t16);
    				}
    			} else if (if_block0) {
    				group_outros();

    				transition_out(if_block0, 1, 1, () => {
    					if_block0 = null;
    				});

    				check_outros();
    			}

    			if (dirty & /*visible*/ 2) {
    				input2.checked = /*visible*/ ctx[1];
    			}

    			if (/*visible*/ ctx[1]) {
    				if (if_block1) {
    					if (dirty & /*visible*/ 2) {
    						transition_in(if_block1, 1);
    					}
    				} else {
    					if_block1 = create_if_block_1(ctx);
    					if_block1.c();
    					transition_in(if_block1, 1);
    					if_block1.m(h51, t19);
    				}
    			} else if (if_block1) {
    				group_outros();

    				transition_out(if_block1, 1, 1, () => {
    					if_block1 = null;
    				});

    				check_outros();
    			}

    			if (dirty & /*visible*/ 2) {
    				input3.checked = /*visible*/ ctx[1];
    			}

    			if (/*visible*/ ctx[1]) {
    				if (if_block2) {
    					if (dirty & /*visible*/ 2) {
    						transition_in(if_block2, 1);
    					}
    				} else {
    					if_block2 = create_if_block(ctx);
    					if_block2.c();
    					transition_in(if_block2, 1);
    					if_block2.m(h51, null);
    				}
    			} else if (if_block2) {
    				group_outros();

    				transition_out(if_block2, 1, 1, () => {
    					if_block2 = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block0);
    			transition_in(if_block1);
    			transition_in(if_block2);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block0);
    			transition_out(if_block1);
    			transition_out(if_block2);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div9);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let name = '';
    	let visible = true;
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function input0_input_handler() {
    		name = this.value;
    		$$invalidate(0, name);
    	}

    	function input1_change_handler() {
    		visible = this.checked;
    		$$invalidate(1, visible);
    	}

    	function input2_change_handler() {
    		visible = this.checked;
    		$$invalidate(1, visible);
    	}

    	function input3_change_handler() {
    		visible = this.checked;
    		$$invalidate(1, visible);
    	}

    	$$self.$capture_state = () => ({ name, fly, visible });

    	$$self.$inject_state = $$props => {
    		if ('name' in $$props) $$invalidate(0, name = $$props.name);
    		if ('visible' in $$props) $$invalidate(1, visible = $$props.visible);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		name,
    		visible,
    		input0_input_handler,
    		input1_change_handler,
    		input2_change_handler,
    		input3_change_handler
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'Teacher'
    	}
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
