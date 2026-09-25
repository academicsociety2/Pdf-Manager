(function(){
    'use strict';

    if(window.__etoRobotStarted) return;
    window.__etoRobotStarted = true;

    const ROBOT_CONFIG = {
        sheet: 'Robot/robot.png',
        frameCount: 6,
        frameCols: 2,
        frameRows: 3,
        desktopSize: 96,
        mobileSize: 82,
        frameDuration: 110,
        walkSpeedDesktop: 58,
        walkSpeedMobile: 44,
        idleMin: 1800,
        idleMax: 3800,
        edgeGap: 18,
        zIndex: 999999,
        thoughtInterval: 20000,
        thoughtDuration: 10000,
        thoughtAudioStart: 1,
        thoughtAudioEnd: 3
    };

    const state = {
        root: null,
        sprite: null,
        frame: 0,
        frameTimer: 0,
        lastTime: 0,
        x: 0,
        targetX: 0,
        direction: 1,
        mode: 'idle',
        idleUntil: 0,
        initialized: false,

        reducedMotion: false,

        thought: null,
        thoughtTimer: null,
        thoughtHideTimer: null,
        thoughtAudio: null,
        audioUnlocked: false
    };

    function getSize(){
        return window.innerWidth <= 640
            ? ROBOT_CONFIG.mobileSize
            : ROBOT_CONFIG.desktopSize;
    }

    function isMobile(){
        return window.innerWidth <= 640;
    }

    function getSpeed(){
        return window.innerWidth <= 640
            ? ROBOT_CONFIG.walkSpeedMobile
            : ROBOT_CONFIG.walkSpeedDesktop;
    }

    function randomBetween(min,max){
        return min + Math.random() * (max - min);
    }

    function clamp(value,min,max){
        return Math.min(Math.max(value,min),max);
    }

    function injectCss(){

        if(document.querySelector('link[data-eto-robot-css]')){
            return Promise.resolve();
        }

        return new Promise(resolve => {

            const link = document.createElement('link');

            link.rel = 'stylesheet';
            link.href = 'Robot/robot.css';
            link.dataset.etoRobotCss = '1';

            link.onload = () => resolve();
            link.onerror = () => resolve();

            document.head.appendChild(link);
        });
    }

    function createDom(){

        if(document.getElementById('eto-robot-root')){

            state.root = document.getElementById('eto-robot-root');
            state.sprite = document.getElementById('eto-robot-sprite');

            return;
        }

        const root = document.createElement('div');

        root.id = 'eto-robot-root';
        root.setAttribute('aria-hidden','true');
        root.dataset.mode = 'idle';
        root.style.position = 'fixed';
        root.style.zIndex = String(ROBOT_CONFIG.zIndex);
        root.style.overflow = 'visible';
        root.style.pointerEvents = 'none';

        const sprite = document.createElement('div');

        sprite.id = 'eto-robot-sprite';
        sprite.style.pointerEvents = 'auto';

        sprite.addEventListener('click', function(event){

            event.preventDefault();
            event.stopPropagation();

            hide();

            if(
                window.EtoRobotUI &&
                typeof window.EtoRobotUI.openChat === 'function'
            ){
                window.EtoRobotUI.openChat();
            }
        });

        sprite.style.setProperty(
            '--eto-robot-sheet',
            `url("${ROBOT_CONFIG.sheet}")`
        );

        sprite.style.transformOrigin = 'center center';

        root.appendChild(sprite);
        document.body.appendChild(root);

        state.root = root;
        state.sprite = sprite;
    }

    function createThoughtBubble(){

        if(state.thought) return;

        const style = document.createElement('style');

        style.id = 'eto-thought-style';

        style.textContent = `
            #eto-robot-thought{
                position:fixed !important;
                left:0;
                top:0;
                width:max-content;
                max-width:180px;
                min-width:74px;
                padding:7px 11px;
                border:1px solid #e2cb59;
                border-radius:6px 15px 15px 15px;
                background:linear-gradient(135deg,#fffdf1 0%,#fff3a1 100%);
                color:#202b44;
                font-family:'Cairo',sans-serif;
                font-size:9px;
                font-weight:900;
                line-height:1.55;
                text-align:center;
                box-shadow:0 10px 24px rgba(15,23,42,.18),0 3px 8px rgba(15,23,42,.08);
                z-index:2147483647 !important;
                opacity:0;
                visibility:hidden;
                display:block !important;
                pointer-events:auto;
                cursor:pointer;
                outline:none;
                appearance:none;
                -webkit-appearance:none;
                transition:opacity .4s ease,transform .4s cubic-bezier(.16,1,.3,1),visibility .4s ease,box-shadow .2s ease;
            }

            #eto-robot-thought.show{
                opacity:1 !important;
                visibility:visible !important;
                transform:translateY(0) rotate(-1deg) scale(1);
            }

            #eto-robot-thought:hover{
                transform:translateY(-2px) rotate(-1deg) scale(1.03);
                box-shadow:0 14px 28px rgba(15,23,42,.22),0 4px 9px rgba(15,23,42,.10);
            }

            #eto-robot-thought:active{
                transform:translateY(0) rotate(-1deg) scale(.97);
            }

            #eto-robot-thought::before{
                content:"✎";
                position:absolute;
                top:-8px;
                left:7px;
                width:19px;
                height:19px;
                border-radius:6px;
                background:#2563eb;
                color:#fff;
                display:flex;
                align-items:center;
                justify-content:center;
                font-size:8px;
                box-shadow:0 3px 9px rgba(37,99,235,.28);
            }

            #eto-robot-thought::after{
                content:"";
                position:absolute;
                left:18px;
                bottom:-6px;
                width:11px;
                height:11px;
                background:#fff3a1;
                border-right:1px solid #e2cb59;
                border-bottom:1px solid #e2cb59;
                transform:rotate(45deg);
            }

            .eto-thought-dots{
                display:inline-flex;
                gap:3px;
                margin-right:3px;
                vertical-align:middle;
            }

            .eto-thought-dots span{
                width:3px;
                height:3px;
                border-radius:50%;
                background:#2563eb;
                animation:etoThoughtDot 1.05s infinite ease-in-out;
            }

            .eto-thought-dots span:nth-child(2){
                animation-delay:.14s;
            }

            .eto-thought-dots span:nth-child(3){
                animation-delay:.28s;
            }

            @keyframes etoThoughtDot{
                0%,60%,100%{
                    opacity:.25;
                    transform:translateY(0);
                }
                30%{
                    opacity:1;
                    transform:translateY(-3px);
                }
            }

            @media(max-width:640px){
                #eto-robot-thought{
                    max-width:150px;
                    min-width:66px;
                    padding:6px 9px;
                    font-size:8.5px;
                }
            }
        `;

        document.head.appendChild(style);

        const thought = document.createElement('button');

        thought.id = 'eto-robot-thought';
        thought.type = 'button';
        thought.setAttribute('aria-label','فتح مساعد Eto.Edu');

        thought.innerHTML =
            'محتاج مساعدة؟ ' +
            '<span class="eto-thought-dots">' +
            '<span></span><span></span><span></span>' +
            '</span>';

        document.body.appendChild(thought);

        state.thought = thought;
    }

    function updateThoughtPosition(){

        if(!state.root || !state.thought) return;

        const rect = state.root.getBoundingClientRect();
        const bubble = state.thought.getBoundingClientRect();

        const left =
            rect.left +
            (rect.width / 2) -
            (bubble.width / 2);

        const top =
            Math.max(
                8,
                rect.top -
                bubble.height -
                10
            );

        state.thought.style.left =
            `${Math.round(left)}px`;

        state.thought.style.top =
            `${Math.round(top)}px`;
    }

    function setupThoughtAudio(){

        if(state.thoughtAudio) return;

        const audio = new Audio(
            'Robot/Bot_Data/Audio/typing.wav'
        );

        audio.preload = 'auto';

        state.thoughtAudio = audio;

        const unlockAudio = () => {

            if(state.audioUnlocked) return;

            state.audioUnlocked = true;

            audio.pause();

            try{
                audio.currentTime = ROBOT_CONFIG.thoughtAudioStart;
            }catch(e){}
        };

        window.addEventListener(
            'pointerdown',
            unlockAudio,
            {once:true,passive:true}
        );

        window.addEventListener(
            'keydown',
            unlockAudio,
            {once:true,passive:true}
        );
    }

    function playThoughtAudio(){

        if(!state.thoughtAudio) return;

        const audio = state.thoughtAudio;

        try{
            audio.pause();
            audio.currentTime = ROBOT_CONFIG.thoughtAudioStart;
        }catch(e){
            return;
        }

        const stopAt = () => {

            if(audio.currentTime >= ROBOT_CONFIG.thoughtAudioEnd){

                audio.pause();
                audio.currentTime = ROBOT_CONFIG.thoughtAudioStart;
                audio.removeEventListener('timeupdate',stopAt);
            }
        };

        audio.addEventListener('timeupdate',stopAt);

        audio.play().catch(() => {});
    }

    function stopThoughtAudio(){

        if(!state.thoughtAudio) return;

        try{
            state.thoughtAudio.pause();
            state.thoughtAudio.currentTime = ROBOT_CONFIG.thoughtAudioStart;
        }catch(e){}
    }

    function startThoughtCycle(){

        if(!state.thought) return;

        const showThought = () => {

            if(!state.thought) return;

            if(
                state.root &&
                state.root.classList.contains('eto-robot-hidden')
            ){
                return;
            }

            updateThoughtPosition();
            const thoughtMessages = [
                'محتاج حاجة؟',
                'محتاج مساعدة؟',
                'أساعدك في حاجة؟',
                'عايز تسأل عن حاجة؟',
                'في حاجة مش واضحة؟',
                'تحب أساعدك؟'
            ];

            const randomMessage =
                thoughtMessages[
                    Math.floor(
                        Math.random() * thoughtMessages.length
                    )
                ];

            state.thought.firstChild.textContent =
                randomMessage + ' ';
            state.thought.classList.add('show');

            playThoughtAudio();

            clearTimeout(state.thoughtHideTimer);

            state.thoughtHideTimer = setTimeout(() => {

                if(!state.thought) return;

                state.thought.classList.remove('show');
                stopThoughtAudio();

            },ROBOT_CONFIG.thoughtDuration);
        };

        state.thoughtTimer = setInterval(
            showThought,
            ROBOT_CONFIG.thoughtInterval
        );
    }

    function setFrame(frame){

        state.frame =
            ((frame % ROBOT_CONFIG.frameCount)
            + ROBOT_CONFIG.frameCount)
            % ROBOT_CONFIG.frameCount;

        const size = getSize();

        const col =
            state.frame % ROBOT_CONFIG.frameCols;

        const row =
            Math.floor(
                state.frame /
                ROBOT_CONFIG.frameCols
            );

        if(state.sprite){

            state.sprite.style.backgroundSize =
                `${size * ROBOT_CONFIG.frameCols}px ${size * ROBOT_CONFIG.frameRows}px`;

            state.sprite.style.backgroundPosition =
                `${-col * size}px ${-row * size}px`;
        }
    }

    function updateDirection(){

        if(!state.root || !state.sprite) return;

        state.root.classList.remove(
            'eto-robot-facing-left'
        );

        state.sprite.style.transform =
            state.direction > 0
                ? 'scaleX(-1)'
                : 'scaleX(1)';
    }

    function updatePosition(){

        if(!state.root) return;

        const size = getSize();

        const maxX = Math.max(
            0,
            window.innerWidth
            - size
            - ROBOT_CONFIG.edgeGap
        );

        state.x = clamp(
            state.x,
            ROBOT_CONFIG.edgeGap,
            maxX
        );

        state.root.style.left =
            `${Math.round(state.x)}px`;

        updateThoughtPosition();
    }

    function emitModeChange(){

        if(!state.root) return;

        state.root.dispatchEvent(
            new CustomEvent('eto-robot-mode',{
                detail:{
                    mode:state.mode
                }
            })
        );
    }

    function chooseNextWalk(){

        const size = getSize();

        const minX = ROBOT_CONFIG.edgeGap;

        const maxX = Math.max(
            minX,
            window.innerWidth
            - size
            - ROBOT_CONFIG.edgeGap
        );

        let next =
            randomBetween(minX,maxX);

        if(
            Math.abs(next - state.x)
            < Math.max(80,window.innerWidth * 0.15)
        ){

            next =
                state.x < (window.innerWidth / 2)
                ? maxX
                : minX;
        }

        state.targetX = next;

        state.direction =
            next >= state.x ? 1 : -1;

        state.mode = 'walking';

        state.root.dataset.mode = 'walking';

        state.root.classList.remove(
            'eto-robot-paused'
        );

        updateDirection();
        emitModeChange();
    }

    function chooseIdle(){

        state.mode = 'idle';

        state.root.dataset.mode = 'idle';

        state.root.classList.add(
            'eto-robot-paused'
        );

        setFrame(0);

        state.idleUntil =
            isMobile()
                ? Infinity
                : performance.now()
                    + randomBetween(
                        ROBOT_CONFIG.idleMin,
                        ROBOT_CONFIG.idleMax
                    );

        emitModeChange();
    }

    function step(timestamp){

        if(!state.lastTime){
            state.lastTime = timestamp;
        }

        const dt =
            Math.min(
                64,
                timestamp - state.lastTime
            );

        state.lastTime = timestamp;

        if(state.mode === 'walking'){

            const distance =
                state.targetX - state.x;

            const stepDistance =
                getSpeed() * dt / 1000;

            if(
                Math.abs(distance)
                <= stepDistance
            ){

                state.x =
                    state.targetX;

                updatePosition();

                chooseIdle();

            }else{

                state.x +=
                    Math.sign(distance)
                    * stepDistance;

                state.frameTimer += dt;

                if(
                    !state.reducedMotion
                    && state.frameTimer
                    >= ROBOT_CONFIG.frameDuration
                ){

                    state.frameTimer = 0;

                    setFrame(
                        state.frame + 1
                    );
                }

                updatePosition();
            }

        }else{

            if(
                !isMobile()
                &&
                timestamp >=
                state.idleUntil
            ){
                chooseNextWalk();
            }
        }

        updateThoughtPosition();

        requestAnimationFrame(step);
    }

    function reveal(){

        if(!state.root) return;

        state.root.classList.remove(
            'eto-robot-hidden'
        );

        updateThoughtPosition();
    }

    function hide(){

        if(!state.root) return;

        state.root.classList.add(
            'eto-robot-hidden'
        );

        if(state.thought){
            state.thought.classList.remove('show');
        }

        stopThoughtAudio();
    }

    window.addEventListener('message', function(event){

        if(event.data !== 'eto-robot-close-chat') return;

        if(state.thought){
            state.thought.classList.remove('show');
        }

        reveal();
    });

    function start(){

        if(state.initialized) return;

        state.initialized = true;

        state.reducedMotion =
            window.matchMedia
            &&
            window.matchMedia(
                '(prefers-reduced-motion: reduce)'
            ).matches;

        const size = getSize();

        state.x =
            Math.max(
                ROBOT_CONFIG.edgeGap,
                window.innerWidth
                - size
                - ROBOT_CONFIG.edgeGap
            );

        updatePosition();

        setFrame(0);

        state.direction = 1;

        updateDirection();

        chooseIdle();

        reveal();

        createThoughtBubble();

        setupThoughtAudio();

        updateThoughtPosition();

        startThoughtCycle();

        state.root.addEventListener(
            'pointerup',
            event => {

                if(!isMobile()) return;

                if(event.pointerType === 'mouse'){
                    return;
                }

                if(state.mode === 'idle'){
                    chooseNextWalk();
                }
            },
            {passive:true}
        );

        requestAnimationFrame(step);

        window.addEventListener(
            'resize',
            () => {

                updatePosition();

                setFrame(
                    state.frame
                );

            },
            {passive:true}
        );
    }

    function setup(){

        createDom();

        start();

        if(window.EtoRobotUIInit){

            window.EtoRobotUIInit();

        }else{

            const waitForUI = setInterval(() => {

                if(window.EtoRobotUIInit){

                    clearInterval(waitForUI);

                    window.EtoRobotUIInit();
                }

            },50);

            setTimeout(() => {

                clearInterval(waitForUI);

            },5000);
        }
    }

    window.EtoRobot = {

        start,

        hide,

        show: reveal,

        walk: chooseNextWalk,

        idle: chooseIdle,

        setFrame,

        getState: () => ({
            ...state
        })
    };

    if(
        document.readyState === 'loading'
    ){

        document.addEventListener(
            'DOMContentLoaded',
            setup,
            {once:true}
        );

    }else{

        setup();
    }

})();