import java.io.File;
import java.awt.image.BufferedImage;
import javax.imageio.ImageIO;
import com.google.zxing.BinaryBitmap;
import com.google.zxing.MultiFormatReader;
import com.google.zxing.RGBLuminanceSource;
import com.google.zxing.Result;
import com.google.zxing.common.HybridBinarizer;
public class BarcodeDecode {
  public static void main(String[] paths) throws Exception {
    for (String path : paths) {
      BufferedImage image = ImageIO.read(new File(path));
      int width = image.getWidth(), height = image.getHeight();
      int[] pixels = image.getRGB(0, 0, width, height, null, 0, width);
      Result result = new MultiFormatReader().decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(width, height, pixels))));
      if (!"123459V".equals(result.getText())) throw new AssertionError(result.getText());
      System.out.println(result.getBarcodeFormat() + ": " + result.getText() + " (" + width + "x" + height + ")");
    }
  }
}
