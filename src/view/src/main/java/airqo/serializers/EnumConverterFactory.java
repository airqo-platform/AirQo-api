package airqo.serializers;

import lombok.AllArgsConstructor;
import org.springframework.core.convert.converter.Converter;
import org.springframework.core.convert.converter.ConverterFactory;
import org.springframework.stereotype.Component;

@Component
public class EnumConverterFactory implements ConverterFactory<String, Enum> {

	@Override
	public <T extends Enum> Converter<String, T> getConverter(Class<T> targetType) {
		return new StringToEnumConverter(targetType);
	}

	@AllArgsConstructor
	private static class StringToEnumConverter<T extends Enum> implements Converter<String, T> {

		private Class<T> enumType;

		public T convert(String source) {
			return (T) Enum.valueOf(this.enumType, source.trim().toUpperCase());
		}
	}
}
