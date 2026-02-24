import React from 'react';

export const Footer: React.FC = () => {
    return (
        <footer>
            <div className="footer-content">
                {/* About Section */}
                <div className="footer-about">
                    <div className="footer-logo">ONDRX</div>
                    <p>
                        While others fight over power, we fight for peace and a future where prosperity is earned, not forced.
                    </p>
                    <p>
                        2025 ONDRX - No false hype, No pump, Just real transparency.
                    </p>
                </div>

                {/* Explore Section */}
                <div className="footer-links">
                    <h4>EXPLORE</h4>
                    <ul>
                        <li><a href="https://ondrix.com/legal.html">Privacy Policy</a></li>
                        <li><a href="https://ondrix.com/about.html">About Ondrx</a></li>
                        <li><a href="https://ondrix.com/vision.html">Vision, Mission & Team</a></li>
                        <li><a href="https://ondrix.com/journal.html">Project Journal</a></li>
                    </ul>
                </div>

                {/* Legal Section */}
                <div className="footer-links">
                    <h4>LEGAL</h4>
                    <ul>
                        <li><a href="https://ondrix.com/legal.html">Privacy Policy</a></li>
                        <li><a href="https://ondrix.com/legal.html">Terms & Conditions</a></li>
                        <li><a href="https://ondrix.com/whitepaper.pdf" target="_blank" rel="noopener noreferrer">Whitepaper</a></li>
                    </ul>
                </div>

                {/* Platform Section */}
                <div className="footer-links">
                    <h4>PLATFORM</h4>
                    <ul>
                        <li><a href="https://escrow.ondrix.com">Escrow</a></li>
                        <li><a href="https://vesting.ondrix.com">Vesting</a></li>
                        <li><a href="/">Exchange</a></li>
                    </ul>
                </div>

                {/* Connect Section */}
                <div className="footer-links">
                    <h4>CONNECT</h4>
                    <div className="footer-social-links">
                        <a href="https://t.me/JoinOndrix" target="_blank" rel="noopener noreferrer" title="Telegram">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 496 512" fill="currentColor"><path d="M248 8C111 8 0 119 0 256s111 248 248 248 248-111 248-248S385 8 248 8zm121.8 169.9l-40.7 191.8c-3 13.6-11.1 16.9-22.4 10.5l-62-45.7-29.9 28.8c-3.3 3.3-6.1 6.1-12.5 6.1l4.4-63.1 114.9-103.8c5-4.4-1.1-6.9-7.7-2.5l-142 89.4-61.2-19.1c-13.3-4.2-13.6-13.3 2.8-19.7l239.1-92.2c11.1-4 20.8 2.7 17.2 19.5z" /></svg>
                            <span>Telegram</span>
                        </a>
                        <a href="https://twitter.com/Ondrixofficial" target="_blank" rel="noopener noreferrer" title="Twitter / X">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M459.37 151.716c.325 4.548.325 9.097.325 13.645 0 138.72-105.583 298.558-298.558 298.558-59.452 0-114.68-17.219-161.137-47.106 8.447.974 16.568 1.299 25.34 1.299 49.055 0 94.213-16.568 130.274-44.832-46.132-.975-84.792-31.188-98.112-72.772 6.498.974 12.995 1.624 19.818 1.624 9.421 0 18.843-1.3 27.614-3.573-48.081-9.747-84.143-51.98-84.143-102.985v-1.299c13.969 7.797 30.214 12.67 47.431 13.319-28.264-18.843-46.781-51.005-46.781-87.391 0-19.492 5.197-37.36 14.294-52.954 51.655 63.675 129.3 105.258 216.365 109.807-1.624-7.797-2.599-15.918-2.599-24.04 0-57.828 46.782-104.934 104.934-104.934 30.213 0 57.502 12.67 76.67 33.137 23.715-4.548 46.456-13.32 66.599-25.34-7.798 24.366-24.366 44.833-46.132 57.827 21.117-2.273 41.584-8.122 60.426-16.568-14.295 21.117-32.167 39.319-52.314 53.578z" /></svg>
                            <span>Twitter</span>
                        </a>
                        <a href="https://medium.com/@Ondrixofficial" target="_blank" rel="noopener noreferrer" title="Medium">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512" fill="currentColor"><path d="M180.5,74.262C80.813,74.262,0,155.633,0,256S80.819,437.738,180.5,437.738,361,356.373,361,256,280.191,74.262,180.5,74.262Zm288.25,10.646c-49.845,0-90.245,76.619-90.245,171.095s40.406,171.1,90.251,171.1,90.251-76.619,90.251-171.1H559C559,161.5,518.6,84.908,468.75,84.908Zm139.5,67.86c-17.523,0-31.735,46.174-31.735,103.235s14.212,103.236,31.735,103.236,31.76-46.174,31.76-103.236S625.755,152.768,608.25,152.768Z" /></svg>
                            <span>Medium</span>
                        </a>
                        <a href="mailto:contact@ondrix.com" title="Email">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M502.3 190.8c3.9-3.1 9.7-.2 9.7 4.7V400c0 26.5-21.5 48-48 48H48c-26.5 0-48-21.5-48-48V195.6c0-5 5.7-7.8 9.7-4.7 22.4 17.4 52.1 39.5 154.1 113.6 21.1 15.4 56.7 47.8 92.2 47.6 35.7.3 72-32.8 92.3-47.6 102-74.1 131.6-96.3 154-113.7zM256 320c23.2.4 56.6-29.2 73.4-41.4 132.7-96.3 142.8-104.7 173.4-128.7 5.8-4.5 9.2-11.5 9.2-18.9v-19c0-26.5-21.5-48-48-48H48C21.5 64 0 85.5 0 112v19c0 7.4 3.4 14.3 9.2 18.9 30.6 23.9 40.7 32.4 173.4 128.7 16.8 12.2 50.2 41.8 73.4 41.4z" /></svg>
                            <span>contact@ondrix.com</span>
                        </a>
                    </div>
                </div>
            </div>

            {/* Copyright */}
            <div className="copyright">
                <p>Powered by ONDRX</p>
                <p>Copyright 2025 ONDRX All Rights Reserved</p>
                <p style={{ marginTop: '15px', fontSize: '0.9rem', opacity: 0.8 }}>
                    ONDRX™ is an independent project and brand. Not affiliated with or infringing any existing trademark or company.
                </p>
            </div>
        </footer>
    );
};
