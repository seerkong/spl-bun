import java.io.File;
import java.awt.image.BufferedImage;
import java.util.EnumMap;
import java.util.Collections;
import javax.imageio.ImageIO;
import com.google.zxing.*;
import com.google.zxing.common.*;
public class BarcodeFormats {
  public static void main(String[] args) throws Exception {
    String[][] cases = {{"QR_CODE","123459V"},{"CODE_128","123459V"},{"CODE_39","ABC123"},{"CODE_93","ABC123"},{"EAN_13","1234567890128"},{"EAN_8","12345670"},{"UPC_A","123456789012"},{"UPC_E","04252614"},{"ITF","1234567890"},{"CODABAR","A123459A"},{"DATA_MATRIX","123459V"},{"AZTEC","123459V"},{"PDF_417","123459V"}};
    int failures=0;
    for(String[] item : cases) {
      try {
      BarcodeFormat format = BarcodeFormat.valueOf(item[0]);
      new MultiFormatWriter().encode(item[1],format,420,200);
      BufferedImage image=ImageIO.read(new File(args[0]+"/"+item[0]+".png"));
      int width=image.getWidth(),height=image.getHeight();
      EnumMap<DecodeHintType,Object> hints=new EnumMap<>(DecodeHintType.class);
      hints.put(DecodeHintType.TRY_HARDER,Boolean.TRUE);hints.put(DecodeHintType.POSSIBLE_FORMATS,Collections.singletonList(format));
      Result result=new MultiFormatReader().decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(width,height,image.getRGB(0,0,width,height,null,0,width)))),hints);
      String expected=format==BarcodeFormat.CODABAR?item[1].substring(1,item[1].length()-1):item[1];
      if(!expected.equals(result.getText()))throw new AssertionError(item[0]+": "+result.getText()+" expected "+expected);
      System.out.println(item[0]+": "+result.getText());
      } catch(Exception error) { failures++;System.out.println(item[0]+": FAILED "+error); }
    }
    for(String format : new String[]{"CODE_39","CODE_93","QR_CODE"}) {
      String suffix=format.equals("QR_CODE")?"_utf8":"_lower",expected=format.equals("QR_CODE")?"中文报表":"Abc123";
      BufferedImage bitmap=ImageIO.read(new File(args[0]+"/"+format+suffix+".png"));
      int width=bitmap.getWidth(),height=bitmap.getHeight();
      Reader reader=format.equals("CODE_39")?new com.google.zxing.oned.Code39Reader(false,true):new MultiFormatReader();
      EnumMap<DecodeHintType,Object> hints=new EnumMap<>(DecodeHintType.class);
      hints.put(DecodeHintType.TRY_HARDER,Boolean.TRUE);
      hints.put(DecodeHintType.POSSIBLE_FORMATS,Collections.singletonList(BarcodeFormat.valueOf(format)));
      Result decoded=reader.decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(width,height,bitmap.getRGB(0,0,width,height,null,0,width)))),hints);
      if(!expected.equals(decoded.getText()))throw new AssertionError(format+suffix+": "+decoded.getText());
      System.out.println(format+suffix+": "+decoded.getText());
    }
    if(failures>0)throw new AssertionError(failures+" barcode formats failed");
  }
}
