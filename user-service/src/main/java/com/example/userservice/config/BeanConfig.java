package com.example.userservice.config;

import org.modelmapper.Conditions;
import org.modelmapper.ModelMapper;
import org.modelmapper.convention.MatchingStrategies;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import com.example.userservice.enums.Active;
import org.modelmapper.Converter;
import org.modelmapper.spi.MappingContext;

@Configuration
public class BeanConfig {

    @Bean
    public ModelMapper modelMapper() {
        ModelMapper mm = new ModelMapper();
        mm.getConfiguration()
                .setMatchingStrategy(MatchingStrategies.STRICT)
                .setPropertyCondition(Conditions.isNotNull())
                .setSkipNullEnabled(true)
                .setAmbiguityIgnored(true);

        mm.addConverter(new Converter<Active, Boolean>() {
            public Boolean convert(MappingContext<Active, Boolean> context) {
                if (context.getSource() == null) {
                    return false;
                }
                return context.getSource() == Active.ACTIVE;
            }
        });

        return mm;
    }

    @Bean
    public BCryptPasswordEncoder bCryptPasswordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
