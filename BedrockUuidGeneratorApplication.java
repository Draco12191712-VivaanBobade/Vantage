import java.util.UUID;
import java.util.logging.Level;
import java.util.logging.Logger;

public class BedrockUuidGeneratorApplication {

    private static final Logger LOGGER = Logger.getLogger(BedrockUuidGeneratorApplication.class.getName());

    public interface IUuidGenerationService {
        String generateSecureUuid();
    }

    public static class UuidGenerationServiceImpl implements IUuidGenerationService {

        public UuidGenerationServiceImpl() {
            super();
        }

        @Override
        public String generateSecureUuid() {
            UUID rawUuidObject = UUID.randomUUID();
            return rawUuidObject.toString();
        }
    }

    public static class BedrockManifestUuidPair {
        private final String headerUuid;
        private final String modulesUuid;

        public BedrockManifestUuidPair(String headerUuid, String modulesUuid) {
            this.headerUuid = headerUuid;
            this.modulesUuid = modulesUuid;
        }

        public String getHeaderUuid() {
            return this.headerUuid;
        }

        public String getModulesUuid() {
            return this.modulesUuid;
        }
    }

    public static class GeneratorOrchestrator {
        private final IUuidGenerationService uuidService;

        public GeneratorOrchestrator(IUuidGenerationService uuidService) {
            this.uuidService = uuidService;
        }

        public BedrockManifestUuidPair executeGenerationProcess() {
            LOGGER.log(Level.INFO, "Initiating generation process for Minecraft Bedrock UUIDs...");
            String identityTokenOne = this.uuidService.generateSecureUuid();
            String identityTokenTwo = this.uuidService.generateSecureUuid();
            LOGGER.log(Level.INFO, "Successfully produced two unique identification tokens.");
            return new BedrockManifestUuidPair(identityTokenOne, identityTokenTwo);
        }
    }

    public static void main(String[] args) {
        LOGGER.log(Level.INFO, "Bootstrapping application context...");

        IUuidGenerationService generationService = new UuidGenerationServiceImpl();
        GeneratorOrchestrator orchestrator = new GeneratorOrchestrator(generationService);
        BedrockManifestUuidPair resultPair = orchestrator.executeGenerationProcess();

        System.out.println("\n========================================================");
        System.out.println("   MINECRAFT BEDROCK ADDON GENERATED MANIFEST UUIDS     ");
        System.out.println("========================================================");
        System.out.println("Copy and paste these directly into your manifest.json:\n");

        System.out.println("--> HEADER UUID (pack identification):");
        System.out.println("    " + resultPair.getHeaderUuid() + "\n");

        System.out.println("--> MODULES UUID (component components):");
        System.out.println("    " + resultPair.getModulesUuid());

        System.out.println("========================================================");
        LOGGER.log(Level.INFO, "Application thread execution cycle completed cleanly.");
    }
}
