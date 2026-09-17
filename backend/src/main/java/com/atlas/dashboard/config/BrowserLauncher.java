package com.atlas.dashboard.config;

import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.ApplicationListener;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import lombok.extern.slf4j.Slf4j;

/**
 * Desktop-app mode (the jpackage bundle): once the server is up, open the UI in
 * the default browser so double-clicking Atlas.app "just opens the dashboard".
 */
@Slf4j
@Component
@Profile("desktop")
public class BrowserLauncher implements ApplicationListener<ApplicationReadyEvent> {

    @Override
    public void onApplicationEvent(ApplicationReadyEvent event) {
        String url = "http://localhost:8080";
        try {
            String os = System.getProperty("os.name", "").toLowerCase();
            if (os.contains("mac")) {
                Runtime.getRuntime().exec(new String[] { "open", url });
            } else if (os.contains("win")) {
                Runtime.getRuntime().exec(new String[] { "rundll32", "url.dll,FileProtocolHandler", url });
            } else {
                Runtime.getRuntime().exec(new String[] { "xdg-open", url });
            }
            log.info("desktop mode: opened {}", url);
        } catch (Exception e) {
            log.warn("desktop mode: could not open browser — visit {} manually", url, e);
        }
    }
}
