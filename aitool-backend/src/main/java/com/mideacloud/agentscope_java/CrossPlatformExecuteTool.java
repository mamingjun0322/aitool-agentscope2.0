package com.mideacloud.agentscope_java;

import io.agentscope.core.tool.Tool;
import io.agentscope.core.tool.ToolParam;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

public class CrossPlatformExecuteTool {

    private static final int DEFAULT_TIMEOUT_SECONDS = 30;
    private static final int MAX_OUTPUT_CHARS = 100_000;

    private final Path defaultWorkingDirectory;

    public CrossPlatformExecuteTool(Path defaultWorkingDirectory) {
        this.defaultWorkingDirectory = defaultWorkingDirectory.toAbsolutePath().normalize();
    }

    @Tool(
            name = "execute",
            description =
                    "Execute a host terminal command. On Windows this runs PowerShell; on Linux"
                            + " and macOS it runs sh. working_directory may be any absolute host"
                            + " path or a path relative to the project directory.",
            concurrencySafe = false)
    public String execute(
            @ToolParam(name = "command", description = "Command to execute") String command,
            @ToolParam(
                            name = "working_directory",
                            description =
                                    "Optional absolute host path or project-relative working directory",
                            required = false)
                    String workingDirectory,
            @ToolParam(
                            name = "timeout",
                            description = "Timeout in seconds, defaults to 30",
                            required = false)
                    Integer timeout) {
        if (command == null || command.isBlank()) {
            return "Exit code: 1\n\nCommand must not be blank.";
        }

        Path cwd;
        try {
            cwd = resolveWorkingDirectory(workingDirectory);
        } catch (IllegalArgumentException exception) {
            return "Exit code: 1\n\n" + exception.getMessage();
        }

        int timeoutSeconds =
                timeout != null && timeout > 0 ? timeout : DEFAULT_TIMEOUT_SECONDS;
        boolean isWindows = System.getProperty("os.name").toLowerCase().contains("win");
        ProcessBuilder processBuilder =
                isWindows
                        ? new ProcessBuilder(
                                "powershell.exe",
                                "-NoLogo",
                                "-NoProfile",
                                "-NonInteractive",
                                "-Command",
                                "[Console]::OutputEncoding=[Text.UTF8Encoding]::new(); " + command)
                        : new ProcessBuilder("sh", "-c", command);

        processBuilder.directory(cwd.toFile()).redirectErrorStream(true);

        try {
            Process process = processBuilder.start();
            CompletableFuture<byte[]> outputFuture =
                    CompletableFuture.supplyAsync(
                            () -> {
                                try {
                                    return process.getInputStream().readAllBytes();
                                } catch (IOException exception) {
                                    throw new IllegalStateException(exception);
                                }
                            });

            boolean finished = process.waitFor(timeoutSeconds, TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                process.waitFor(5, TimeUnit.SECONDS);
                return "Exit code: 124\n\nCommand timed out after "
                        + timeoutSeconds
                        + " seconds.";
            }

            String output =
                    new String(outputFuture.join(), StandardCharsets.UTF_8).stripTrailing();
            if (output.length() > MAX_OUTPUT_CHARS) {
                output = output.substring(0, MAX_OUTPUT_CHARS) + "\n\n(output truncated)";
            }

            int exitCode = process.exitValue();
            return "Exit code: "
                    + exitCode
                    + (output.isBlank() ? "" : "\n\n" + output);
        } catch (IOException exception) {
            return "Exit code: 1\n\nUnable to start command: " + exception.getMessage();
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            return "Exit code: 130\n\nCommand was interrupted.";
        }
    }

    private Path resolveWorkingDirectory(String workingDirectory) {
        Path resolved =
                workingDirectory == null || workingDirectory.isBlank()
                        ? defaultWorkingDirectory
                        : Paths.get(workingDirectory.strip());

        if (!resolved.isAbsolute()) {
            resolved = defaultWorkingDirectory.resolve(resolved);
        }
        resolved = resolved.toAbsolutePath().normalize();

        if (!Files.isDirectory(resolved)) {
            throw new IllegalArgumentException(
                    "Working directory does not exist or is not a directory: " + resolved);
        }
        return resolved;
    }
}
