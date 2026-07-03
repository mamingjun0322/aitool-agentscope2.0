package com.mideacloud.agentscope_java;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class CrossPlatformExecuteToolTests {

    @Test
    void executesCommandInAbsoluteWorkingDirectory(@TempDir Path tempDirectory) throws Exception {
        Files.writeString(tempDirectory.resolve("absolute-path-test.txt"), "ok");

        CrossPlatformExecuteTool tool = new CrossPlatformExecuteTool(Path.of("."));
        boolean isWindows = System.getProperty("os.name").toLowerCase().contains("win");
        String command = isWindows ? "Get-ChildItem -Name" : "ls";
        String result = tool.execute(command, tempDirectory.toString(), 10);

        assertTrue(result.startsWith("Exit code: 0"), result);
        assertTrue(result.contains("absolute-path-test.txt"), result);
    }
}
